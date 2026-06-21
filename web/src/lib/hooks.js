// Shared React Query hooks.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import { DEFAULT_SITE_PROFILE } from "./siteProfileDefaults";

export function useSiteProfile() {
  return useQuery({
    queryKey: ["site-profile"],
    queryFn: () => api.get("/v1/site-profile"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSiteProfileContent() {
  const { data, ...rest } = useSiteProfile();
  return { profile: data ?? DEFAULT_SITE_PROFILE, ...rest };
}

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get("/v1/cart"),
    enabled: !!user,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => api.post("/v1/cart/items", vars),
    onSuccess: (data) => qc.setQueryData(["cart"], data),
  });
}
