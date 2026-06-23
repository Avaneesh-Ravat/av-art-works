// Package service contains the order-service business logic: cart management,
// checkout (with cross-service stock reservation against the catalog service),
// order history/status, and wishlist.
package service

import (
	"context"
	"log/slog"

	"avartworks/services/order-service/internal/client"
	"avartworks/services/order-service/internal/domain"
	"avartworks/services/order-service/internal/repository"
)

// Service holds order dependencies.
type Service struct {
	repo    *repository.Repository
	catalog *client.Catalog
	log     *slog.Logger
}

// New constructs the order Service.
func New(repo *repository.Repository, catalog *client.Catalog, log *slog.Logger) *Service {
	return &Service{repo: repo, catalog: catalog, log: log}
}

// GetCart returns the user's cart enriched with live product data.
func (s *Service) GetCart(ctx context.Context, userID string) (*domain.Cart, error) {
	cartID, err := s.repo.GetOrCreateCart(ctx, userID)
	if err != nil {
		return nil, err
	}
	raw, err := s.repo.GetCartItems(ctx, cartID)
	if err != nil {
		return nil, err
	}
	cart := &domain.Cart{ID: cartID, UserID: userID}
	for _, ri := range raw {
		p, err := s.catalog.GetProduct(ctx, ri.ProductID)
		if err != nil {
			// Skip products that no longer exist; keep the cart usable.
			s.log.Warn("cart product lookup failed", "product_id", ri.ProductID, "err", err)
			continue
		}
		line := domain.CartItem{
			ID:         ri.ID,
			ProductID:  ri.ProductID,
			Title:      p.Title,
			Slug:       p.Slug,
			PricePaise: p.PricePaise,
			Price:      float64(p.PricePaise) / 100,
			Quantity:   ri.Quantity,
			Stock:      p.Stock,
			LinePaise:  p.PricePaise * int64(ri.Quantity),
		}
		cart.TotalPaise += line.LinePaise
		cart.Items = append(cart.Items, line)
	}
	cart.Total = float64(cart.TotalPaise) / 100
	return cart, nil
}

// AddToCart validates the product and available stock, then adds to the cart.
func (s *Service) AddToCart(ctx context.Context, userID, productID string, qty int) error {
	p, err := s.catalog.GetProduct(ctx, productID)
	if err != nil {
		if err == client.ErrProductNotFound {
			return domain.ErrProductInvalid
		}
		return err
	}
	if !p.IsActive {
		return domain.ErrProductInvalid
	}
	cartID, err := s.repo.GetOrCreateCart(ctx, userID)
	if err != nil {
		return err
	}
	currentQty, err := s.cartQtyForProduct(ctx, cartID, productID)
	if err != nil {
		return err
	}
	if currentQty+qty > p.Stock {
		return domain.ErrOutOfStock
	}
	return s.repo.AddToCart(ctx, cartID, productID, qty)
}

// UpdateCartItem sets a line quantity, removing the line when qty is zero.
func (s *Service) UpdateCartItem(ctx context.Context, userID, itemID string, qty int) error {
	cartID, err := s.repo.GetOrCreateCart(ctx, userID)
	if err != nil {
		return err
	}
	if qty <= 0 {
		return s.repo.DeleteCartItem(ctx, cartID, itemID)
	}
	item, err := s.findCartItem(ctx, cartID, itemID)
	if err != nil {
		return err
	}
	p, err := s.catalog.GetProduct(ctx, item.ProductID)
	if err != nil {
		if err == client.ErrProductNotFound {
			return domain.ErrProductInvalid
		}
		return err
	}
	if qty > p.Stock {
		return domain.ErrOutOfStock
	}
	return s.repo.UpdateCartItem(ctx, cartID, itemID, qty)
}

func (s *Service) cartQtyForProduct(ctx context.Context, cartID, productID string) (int, error) {
	raw, err := s.repo.GetCartItems(ctx, cartID)
	if err != nil {
		return 0, err
	}
	for _, ri := range raw {
		if ri.ProductID == productID {
			return ri.Quantity, nil
		}
	}
	return 0, nil
}

func (s *Service) findCartItem(ctx context.Context, cartID, itemID string) (*repository.RawCartItem, error) {
	raw, err := s.repo.GetCartItems(ctx, cartID)
	if err != nil {
		return nil, err
	}
	for i := range raw {
		if raw[i].ID == itemID {
			return &raw[i], nil
		}
	}
	return nil, domain.ErrNotFound
}

// RemoveCartItem removes a line.
func (s *Service) RemoveCartItem(ctx context.Context, userID, itemID string) error {
	cartID, err := s.repo.GetOrCreateCart(ctx, userID)
	if err != nil {
		return err
	}
	return s.repo.DeleteCartItem(ctx, cartID, itemID)
}

// Checkout converts the cart into an order, reserving stock in the catalog
// service first and compensating (releasing) on any failure.
func (s *Service) Checkout(ctx context.Context, userID string, addr domain.Address) (*domain.Order, error) {
	cartID, err := s.repo.GetOrCreateCart(ctx, userID)
	if err != nil {
		return nil, err
	}
	raw, err := s.repo.GetCartItems(ctx, cartID)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return nil, domain.ErrEmptyCart
	}
	if addr.Line1 == "" || addr.City == "" || addr.Pincode == "" {
		return nil, domain.ErrBadAddress
	}
	if addr.Country == "" {
		addr.Country = "India"
	}

	order := &domain.Order{UserID: userID, Address: addr}
	var reserved []client.Product // track for compensation

	release := func() {
		for _, p := range reserved {
			for _, ri := range raw {
				if ri.ProductID == p.ID {
					_ = s.catalog.Release(ctx, p.ID, ri.Quantity)
				}
			}
		}
	}

	for _, ri := range raw {
		p, err := s.catalog.GetProduct(ctx, ri.ProductID)
		if err != nil {
			release()
			return nil, domain.ErrProductInvalid
		}
		if !p.IsActive {
			release()
			return nil, domain.ErrProductInvalid
		}
		if err := s.catalog.Reserve(ctx, ri.ProductID, ri.Quantity); err != nil {
			release()
			if err == client.ErrOutOfStock {
				return nil, domain.ErrOutOfStock
			}
			return nil, err
		}
		reserved = append(reserved, *p)
		order.Items = append(order.Items, domain.OrderItem{
			ProductID:  p.ID,
			Title:      p.Title,
			PricePaise: p.PricePaise,
			Price:      float64(p.PricePaise) / 100,
			Quantity:   ri.Quantity,
		})
		order.TotalPaise += p.PricePaise * int64(ri.Quantity)
	}
	order.Total = float64(order.TotalPaise) / 100

	created, err := s.repo.CreateOrder(ctx, order, cartID)
	if err != nil {
		release() // DB failed after reserving; give stock back.
		return nil, err
	}
	s.log.Info("order created", "order_id", created.ID, "user_id", userID, "total_paise", created.TotalPaise)
	return created, nil
}

// ListOrders returns a user's order history.
func (s *Service) ListOrders(ctx context.Context, userID string) ([]domain.Order, error) {
	return s.repo.ListOrders(ctx, userID)
}

// GetOrder returns a user's order detail.
func (s *Service) GetOrder(ctx context.Context, userID, id string) (*domain.Order, error) {
	return s.repo.GetOrder(ctx, userID, id)
}

// GetOrderByID returns any order detail (admin/internal use).
func (s *Service) GetOrderByID(ctx context.Context, id string) (*domain.Order, error) {
	return s.repo.GetOrderByID(ctx, id)
}

// ListAllOrders returns all orders for admins.
func (s *Service) ListAllOrders(ctx context.Context, limit, offset int) ([]domain.Order, error) {
	return s.repo.ListAllOrders(ctx, limit, offset)
}

// UpdateStatus changes order status and adjusts catalog stock accordingly:
// transitioning to paid commits reserved stock; cancelling releases it.
func (s *Service) UpdateStatus(ctx context.Context, id, status string) error {
	if !domain.ValidStatuses[status] {
		return domain.ErrBadStatus
	}
	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.repo.UpdateStatus(ctx, id, status); err != nil {
		return err
	}
	s.adjustStockOnTransition(ctx, order, status)
	return nil
}

// MarkPaid is called by the payment service when payment is captured.
func (s *Service) MarkPaid(ctx context.Context, id string) error {
	order, err := s.repo.GetOrderByID(ctx, id)
	if err != nil {
		return err
	}
	if order.Status == domain.StatusPaid {
		return nil // idempotent
	}
	if err := s.repo.UpdateStatus(ctx, id, domain.StatusPaid); err != nil {
		return err
	}
	s.adjustStockOnTransition(ctx, order, domain.StatusPaid)
	return nil
}

func (s *Service) adjustStockOnTransition(ctx context.Context, order *domain.Order, newStatus string) {
	switch {
	case newStatus == domain.StatusPaid && order.Status == domain.StatusPending:
		for _, it := range order.Items {
			if err := s.catalog.Commit(ctx, it.ProductID, it.Quantity); err != nil {
				s.log.Error("commit stock failed", "order_id", order.ID, "product_id", it.ProductID, "err", err)
			}
		}
	case newStatus == domain.StatusCancelled && order.Status == domain.StatusPending:
		for _, it := range order.Items {
			if err := s.catalog.Release(ctx, it.ProductID, it.Quantity); err != nil {
				s.log.Error("release stock failed", "order_id", order.ID, "product_id", it.ProductID, "err", err)
			}
		}
	}
}

// ---- Wishlist ----

// AddWishlist saves a product to the wishlist.
func (s *Service) AddWishlist(ctx context.Context, userID, productID string) error {
	return s.repo.AddWishlist(ctx, userID, productID)
}

// RemoveWishlist removes a product from the wishlist.
func (s *Service) RemoveWishlist(ctx context.Context, userID, productID string) error {
	return s.repo.RemoveWishlist(ctx, userID, productID)
}

// ListWishlist returns the wishlist enriched with product data.
func (s *Service) ListWishlist(ctx context.Context, userID string) ([]domain.WishlistItem, error) {
	ids, err := s.repo.ListWishlist(ctx, userID)
	if err != nil {
		return nil, err
	}
	var out []domain.WishlistItem
	for _, id := range ids {
		p, err := s.catalog.GetProduct(ctx, id)
		if err != nil {
			continue
		}
		out = append(out, domain.WishlistItem{
			ProductID:  p.ID,
			Title:      p.Title,
			Slug:       p.Slug,
			Price:      float64(p.PricePaise) / 100,
			PricePaise: p.PricePaise,
		})
	}
	return out, nil
}
