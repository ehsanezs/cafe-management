import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Database = {
  public: {
    Tables: {
      branches: {
        Row: {
          id: string;
          code: string;
          name: string;
          address: string | null;
          phone: string | null;
          logo_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          is_active: boolean;
          default_branch_id: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          is_active?: boolean;
          default_branch_id?: string | null;
          last_login_at?: string | null;
        };
        Update: {
          email?: string;
          full_name?: string;
          phone?: string | null;
          is_active?: boolean;
          default_branch_id?: string | null;
          last_login_at?: string | null;
        };
      };
      roles: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
        };
        Update: {
          display_name?: string;
          description?: string | null;
        };
      };
      permissions: {
        Row: {
          id: string;
          code: string;
          display_name: string;
          module: string;
        };
        Insert: {
          id?: string;
          code: string;
          display_name: string;
          module: string;
        };
        Update: {
          display_name?: string;
          module?: string;
        };
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          branch_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          branch_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          assigned_by?: string | null;
        };
      };
      settings: {
        Row: {
          id: string;
          branch_id: string | null;
          restaurant_name: string | null;
          address: string | null;
          phone: string | null;
          logo_url: string | null;
          currency: string;
          show_rial_alongside: boolean;
          tax_enabled: boolean;
          default_tax_rate: number;
          cost_method: string;
          target_food_cost_percent: number;
          variance_threshold_percent: number;
          waste_threshold_value: number;
          void_policy: Record<string, unknown>;
          loyalty_enabled: boolean;
          loyalty_points_per_toman: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          branch_id?: string | null;
          restaurant_name?: string | null;
          address?: string | null;
          phone?: string | null;
          logo_url?: string | null;
          currency?: string;
          show_rial_alongside?: boolean;
          tax_enabled?: boolean;
          default_tax_rate?: number;
          cost_method?: string;
          target_food_cost_percent?: number;
          variance_threshold_percent?: number;
          waste_threshold_value?: number;
          void_policy?: Record<string, unknown>;
          loyalty_enabled?: boolean;
          loyalty_points_per_toman?: number;
        };
        Update: {
          restaurant_name?: string | null;
          address?: string | null;
          phone?: string | null;
          logo_url?: string | null;
          currency?: string;
          show_rial_alongside?: boolean;
          tax_enabled?: boolean;
          default_tax_rate?: number;
          cost_method?: string;
          target_food_cost_percent?: number;
          variance_threshold_percent?: number;
          waste_threshold_value?: number;
          void_policy?: Record<string, unknown>;
          loyalty_enabled?: boolean;
          loyalty_points_per_toman?: number;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          branch_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          old_values: Record<string, unknown> | null;
          new_values: Record<string, unknown> | null;
          reason: string | null;
          ip_address: string | null;
          device_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          branch_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          old_values?: Record<string, unknown> | null;
          new_values?: Record<string, unknown> | null;
          reason?: string | null;
          ip_address?: string | null;
          device_id?: string | null;
        };
        Update: {};
      };
    };
    Functions: {
      next_number: {
        Args: { p_sequence_key: string; p_branch_id: string };
        Returns: string;
      };
      log_audit: {
        Args: {
          p_user_id: string;
          p_branch_id: string;
          p_action: string;
          p_entity_type?: string;
          p_entity_id?: string;
          p_old_values?: Record<string, unknown>;
          p_new_values?: Record<string, unknown>;
          p_reason?: string;
          p_device_id?: string;
        };
        Returns: string;
      };
    };
  };
};
