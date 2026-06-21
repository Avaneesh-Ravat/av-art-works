// Shared React Query hooks.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Cart } from "../types";

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<Cart>("/v1/cart"),
    enabled: !!user,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { product_id: string; quantity: number }) =>
      api.post<Cart>("/v1/cart/items", vars),
    onSuccess: (data) => qc.setQueryData(["cart"], data),
  });
}
