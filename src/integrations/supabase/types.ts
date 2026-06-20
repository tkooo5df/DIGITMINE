export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      auto_delivery_stock: {
        Row: {
          created_at: string
          id: string
          offer_id: string
          payload: string
          used: boolean
          used_at: string | null
          used_by_order: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          offer_id: string
          payload: string
          used?: boolean
          used_at?: string | null
          used_by_order?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          offer_id?: string
          payload?: string
          used?: boolean
          used_at?: string | null
          used_by_order?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_delivery_stock_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_url: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          visible: boolean
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          visible?: boolean
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          category_id: string | null
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          min_order_usd: number | null
          product_id: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_usd?: number | null
          product_id?: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          category_id?: string | null
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order_usd?: number | null
          product_id?: string | null
          type?: Database["public"]["Enums"]["coupon_type"]
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate: {
        Row: {
          created_at: string
          id: string
          rate: number
          set_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rate: number
          set_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rate?: number
          set_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      order_messages: {
        Row: {
          attachment_url: string | null
          body: string | null
          created_at: string
          id: string
          internal_note: boolean
          is_admin: boolean
          order_id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          internal_note?: boolean
          is_admin?: boolean
          order_id: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          internal_note?: boolean
          is_admin?: boolean
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_id: string | null
          created_at: string
          delivered_at: string | null
          delivered_payload: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          exchange_rate_used: number
          id: string
          internal_notes: string | null
          offer_id: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_id: string
          quantity: number
          status: Database["public"]["Enums"]["order_status"]
          telegram_chat_id: number | null
          telegram_message_id: number | null
          telegram_notified_at: string | null
          total_dzd: number
          total_usd: number
          unit_price_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_payload?: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          exchange_rate_used: number
          id?: string
          internal_notes?: string | null
          offer_id: string
          order_number?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id: string
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          telegram_notified_at?: string | null
          total_dzd: number
          total_usd: number
          unit_price_usd: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_payload?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          exchange_rate_used?: number
          id?: string
          internal_notes?: string | null
          offer_id?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          telegram_notified_at?: string | null
          total_dzd?: number
          total_usd?: number
          unit_price_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "product_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_info: string | null
          active: boolean
          display_name: string
          id: string
          instructions: string | null
          method: Database["public"]["Enums"]["payment_method"]
          qr_code_url: string | null
          updated_at: string
        }
        Insert: {
          account_info?: string | null
          active?: boolean
          display_name: string
          id?: string
          instructions?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          qr_code_url?: string | null
          updated_at?: string
        }
        Update: {
          account_info?: string | null
          active?: boolean
          display_name?: string
          id?: string
          instructions?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          qr_code_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          amount_claimed: number | null
          created_at: string
          file_path: string
          id: string
          order_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          telegram_chat_id: number | null
          telegram_message_id: number | null
          telegram_notified_at: string | null
          user_id: string
        }
        Insert: {
          amount_claimed?: number | null
          created_at?: string
          file_path: string
          id?: string
          order_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          telegram_notified_at?: string | null
          user_id: string
        }
        Update: {
          amount_claimed?: number | null
          created_at?: string
          file_path?: string
          id?: string
          order_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          telegram_notified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offers: {
        Row: {
          active: boolean
          created_at: string
          delivery_method: string | null
          delivery_notes: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          discount_usd: number | null
          duration: string | null
          id: string
          name: string
          price_dzd: number | null
          price_usd: number
          product_id: string
          sort_order: number
          stock: number
          supplier: string | null
          warranty: string | null
          product_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          delivery_method?: string | null
          delivery_notes?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount_usd?: number | null
          duration?: string | null
          id?: string
          name: string
          price_dzd?: number | null
          price_usd: number
          product_id: string
          sort_order?: number
          stock?: number
          supplier?: string | null
          warranty?: string | null
          product_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          delivery_method?: string | null
          delivery_notes?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount_usd?: number | null
          duration?: string | null
          id?: string
          name?: string
          price_dzd?: number | null
          price_usd?: number
          product_id?: string
          sort_order?: number
          stock?: number
          supplier?: string | null
          warranty?: string | null
          product_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          product_id: string
          rating: number
          suggestions: string[] | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          rating: number
          suggestions?: string[] | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          rating?: number
          suggestions?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          banner_image: string | null
          category_id: string | null
          created_at: string
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          description: string | null
          family: string | null
          featured: boolean
          gallery: string[] | null
          id: string
          main_image: string | null
          name: string
          original_price_dzd: number | null
          rating: number
          rating_count: number
          sales_count: number
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          slug: string
          tags: string[] | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          banner_image?: string | null
          category_id?: string | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          description?: string | null
          family?: string | null
          featured?: boolean
          gallery?: string[] | null
          id?: string
          main_image?: string | null
          name: string
          original_price_dzd?: number | null
          rating?: number
          rating_count?: number
          sales_count?: number
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug: string
          tags?: string[] | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          banner_image?: string | null
          category_id?: string | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          description?: string | null
          family?: string | null
          featured?: boolean
          gallery?: string[] | null
          id?: string
          main_image?: string | null
          name?: string
          original_price_dzd?: number | null
          rating?: number
          rating_count?: number
          sales_count?: number
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug?: string
          tags?: string[] | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          banned: boolean
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          banned?: boolean
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          banned?: boolean
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          ad_banner_link: string | null
          ad_banner_url: string | null
          ad_banner_visible: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          ad_banner_link?: string | null
          ad_banner_url?: string | null
          ad_banner_visible?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          ad_banner_link?: string | null
          ad_banner_url?: string | null
          ad_banner_visible?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      telegram_admin_state: {
        Row: {
          app_message_id: number | null
          awaiting_note_order_id: string | null
          awaiting_note_receipt_id: string | null
          awaiting_receipt_offer_id: string | null
          awaiting_receipt_payment_method: string | null
          awaiting_receipt_quantity: number | null
          chat_id: number
          updated_at: string
        }
        Insert: {
          app_message_id?: number | null
          awaiting_note_order_id?: string | null
          awaiting_note_receipt_id?: string | null
          awaiting_receipt_offer_id?: string | null
          awaiting_receipt_payment_method?: string | null
          awaiting_receipt_quantity?: number | null
          chat_id: number
          updated_at?: string
        }
        Update: {
          app_message_id?: number | null
          awaiting_note_order_id?: string | null
          awaiting_note_receipt_id?: string | null
          awaiting_receipt_offer_id?: string | null
          awaiting_receipt_payment_method?: string | null
          awaiting_receipt_quantity?: number | null
          chat_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_chat_prefs: {
        Row: {
          chat_id: number
          currency: string
          language: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          currency?: string
          language?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          currency?: string
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          chat_id: number
          created_at: string
          expires_at: string
          first_name: string | null
          token: string
          used: boolean
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          expires_at?: string
          first_name?: string | null
          token: string
          used?: boolean
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          expires_at?: string
          first_name?: string | null
          token?: string
          used?: boolean
          username?: string | null
        }
        Relationships: []
      }
      telegram_processed_updates: {
        Row: {
          processed_at: string
          update_id: number
        }
        Insert: {
          processed_at?: string
          update_id: number
        }
        Update: {
          processed_at?: string
          update_id?: number
        }
        Relationships: []
      }
      telegram_users: {
        Row: {
          chat_id: number
          first_name: string | null
          linked_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          first_name?: string | null
          linked_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          first_name?: string | null
          linked_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_profile: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      product_buyer_count: { Args: { _product_id: string }; Returns: number }
      user_public_stats: {
        Args: { _user_id: string }
        Returns: {
          orders_count: number
          reviews_count: number
          score: number
          total_spent_dzd: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      coupon_type: "percent" | "fixed"
      delivery_type: "auto" | "manual"
      order_status:
        | "pending"
        | "submitted"
        | "verified"
        | "processing"
        | "delivered"
        | "completed"
        | "cancelled"
        | "refunded"
        | "disputed"
      payment_method: "binance" | "baridimob" | "ccp"
      payment_status: "pending" | "submitted" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "customer"],
      coupon_type: ["percent", "fixed"],
      delivery_type: ["auto", "manual"],
      order_status: [
        "pending",
        "submitted",
        "verified",
        "processing",
        "delivered",
        "completed",
        "cancelled",
        "refunded",
        "disputed",
      ],
      payment_method: ["binance", "baridimob", "ccp"],
      payment_status: ["pending", "submitted", "approved", "rejected"],
    },
  },
} as const
