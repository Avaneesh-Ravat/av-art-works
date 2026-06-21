// Shared API types mirroring the backend JSON contracts.

export type Role = "user" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: Role;
  created_at: string;
}

export interface Address {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_default: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface ProductImage {
  id?: string;
  url: string;
  sort_order: number;
}

export interface Product {
  id: string;
  category_id?: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  price_paise: number;
  medium: string;
  is_active: boolean;
  stock: number;
  images?: ProductImage[];
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  title: string;
  slug?: string;
  price: number;
  quantity: number;
  stock: number;
  line_total_paise: number;
}

export interface Cart {
  id: string;
  items: CartItem[] | null;
  total: number;
}

export interface OrderItem {
  id: string;
  product_id: string;
  title: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  total: number;
  status: string;
  shipping_address: Address;
  items?: OrderItem[];
  created_at: string;
}

export interface WishlistItem {
  product_id: string;
  title: string;
  slug?: string;
  price: number;
}

export interface Testimonial {
  name: string;
  text: string;
}

export interface SiteProfile {
  site_name: string;
  footer_tagline: string;
  hero_tagline: string;
  hero_title: string;
  hero_description: string;
  about_title: string;
  about_text: string;
  about_image_url?: string;
  about_image_s3_key?: string;
  email: string;
  phone: string;
  location: string;
  instagram_url: string;
  facebook_url: string;
  pinterest_url: string;
  testimonials: Testimonial[];
  updated_at: string;
}

export interface SiteProfileInput {
  site_name: string;
  footer_tagline: string;
  hero_tagline: string;
  hero_title: string;
  hero_description: string;
  email: string;
  phone: string;
  location: string;
  instagram_url: string;
  facebook_url: string;
  pinterest_url: string;
  testimonials: Testimonial[];
}

export interface AboutSectionInput {
  about_title: string;
  about_text: string;
  about_image_s3_key: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}
