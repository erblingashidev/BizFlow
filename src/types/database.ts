export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          company_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          ip_address: unknown;
          metadata: NonNullable<Json>;
          user_agent: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          company_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown;
          metadata?: NonNullable<Json>;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          company_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: unknown;
          metadata?: NonNullable<Json>;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_invoices: {
        Row: {
          company_id: string;
          created_at: string;
          currency: string;
          due_at: string | null;
          id: string;
          invoice_number: string;
          issued_at: string | null;
          notes: string | null;
          paid_at: string | null;
          pdf_path: string | null;
          period_end: string | null;
          period_start: string | null;
          provider_invoice_id: string | null;
          status: string;
          subscription_id: string | null;
          subtotal: number;
          tax_total: number;
          total: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          currency?: string;
          due_at?: string | null;
          id?: string;
          invoice_number: string;
          issued_at?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          pdf_path?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          provider_invoice_id?: string | null;
          status?: string;
          subscription_id?: string | null;
          subtotal?: number;
          tax_total?: number;
          total?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          currency?: string;
          due_at?: string | null;
          id?: string;
          invoice_number?: string;
          issued_at?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          pdf_path?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          provider_invoice_id?: string | null;
          status?: string;
          subscription_id?: string | null;
          subtotal?: number;
          tax_total?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_invoices_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_invoices_subscription_fk";
            columns: ["subscription_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      billing_payments: {
        Row: {
          amount: number;
          company_id: string;
          created_at: string;
          currency: string;
          id: string;
          invoice_id: string;
          method: string;
          paid_at: string | null;
          provider_payment_id: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          company_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          invoice_id: string;
          method: string;
          paid_at?: string | null;
          provider_payment_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          invoice_id?: string;
          method?: string;
          paid_at?: string | null;
          provider_payment_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_payments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_payments_invoice_fk";
            columns: ["invoice_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "billing_invoices";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      companies: {
        Row: {
          address: string | null;
          business_number: string | null;
          city: string | null;
          country_code: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          default_locale: string;
          deleted_at: string | null;
          email: string | null;
          fiscal_number: string | null;
          id: string;
          legal_name: string | null;
          logo_path: string | null;
          name: string;
          phone: string | null;
          slug: string;
          status: string;
          timezone: string;
          updated_at: string;
          vat_number: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          business_number?: string | null;
          city?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          default_locale?: string;
          deleted_at?: string | null;
          email?: string | null;
          fiscal_number?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          name: string;
          phone?: string | null;
          slug: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
          vat_number?: string | null;
        };
        Update: {
          address?: string | null;
          business_number?: string | null;
          city?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          default_locale?: string;
          deleted_at?: string | null;
          email?: string | null;
          fiscal_number?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          name?: string;
          phone?: string | null;
          slug?: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
          vat_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          invited_by: string | null;
          job_title: string | null;
          joined_at: string | null;
          role_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          invited_by?: string | null;
          job_title?: string | null;
          joined_at?: string | null;
          role_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          invited_by?: string | null;
          job_title?: string | null;
          joined_at?: string | null;
          role_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          business_number: string | null;
          city: string | null;
          company_id: string;
          contact_person: string | null;
          country_code: string;
          created_at: string;
          created_by: string | null;
          customer_type: string;
          deleted_at: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
          vat_number: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          business_number?: string | null;
          city?: string | null;
          company_id: string;
          contact_person?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          customer_type?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Update: {
          address?: string | null;
          business_number?: string | null;
          city?: string | null;
          company_id?: string;
          contact_person?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          customer_type?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      document_sequences: {
        Row: {
          company_id: string;
          doc_type: string;
          next_value: number;
          prefix: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          doc_type: string;
          next_value?: number;
          prefix: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          doc_type?: string;
          next_value?: number;
          prefix?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_sequences_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          color: string | null;
          company_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string | null;
          company_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          company_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          description: string;
          expense_date: string;
          id: string;
          payment_method: string;
          receipt_path: string | null;
          reference: string | null;
          supplier_id: string | null;
          updated_at: string;
          vat_amount: number;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          category_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          description: string;
          expense_date?: string;
          id?: string;
          payment_method?: string;
          receipt_path?: string | null;
          reference?: string | null;
          supplier_id?: string | null;
          updated_at?: string;
          vat_amount?: number;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          description?: string;
          expense_date?: string;
          id?: string;
          payment_method?: string;
          receipt_path?: string | null;
          reference?: string | null;
          supplier_id?: string | null;
          updated_at?: string;
          vat_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_fk";
            columns: ["category_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "expenses_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_supplier_fk";
            columns: ["supplier_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      permissions: {
        Row: {
          created_at: string;
          description: string | null;
          key: string;
          module: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          key: string;
          module: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          key?: string;
          module?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          created_at: string;
          note: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          note?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          company_id: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          parent_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_categories_parent_fk";
            columns: ["parent_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      products: {
        Row: {
          barcode: string | null;
          category_id: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          default_warehouse_id: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          min_stock: number;
          name: string;
          product_type: string;
          purchase_price: number;
          sale_price: number;
          sku: string;
          track_inventory: boolean;
          unit: string;
          updated_at: string;
          vat_rate: number;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          category_id?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          default_warehouse_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          min_stock?: number;
          name: string;
          product_type?: string;
          purchase_price?: number;
          sale_price?: number;
          sku: string;
          track_inventory?: boolean;
          unit?: string;
          updated_at?: string;
          vat_rate?: number;
        };
        Update: {
          barcode?: string | null;
          category_id?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          default_warehouse_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          min_stock?: number;
          name?: string;
          product_type?: string;
          purchase_price?: number;
          sale_price?: number;
          sku?: string;
          track_inventory?: boolean;
          unit?: string;
          updated_at?: string;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_fk";
            columns: ["category_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "products_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_default_warehouse_fk";
            columns: ["default_warehouse_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          locale: string;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          company_id: string;
          created_at: string;
          description: string | null;
          id: string;
          line_subtotal: number;
          line_tax: number;
          line_total: number;
          product_id: string;
          purchase_order_id: string;
          quantity: number;
          quantity_received: number;
          sort_order: number;
          unit_cost: number;
          updated_at: string;
          vat_rate: number;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          line_subtotal: number;
          line_tax?: number;
          line_total: number;
          product_id: string;
          purchase_order_id: string;
          quantity: number;
          quantity_received?: number;
          sort_order?: number;
          unit_cost: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          line_subtotal?: number;
          line_tax?: number;
          line_total?: number;
          product_id?: string;
          purchase_order_id?: string;
          quantity?: number;
          quantity_received?: number;
          sort_order?: number;
          unit_cost?: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_order_fk";
            columns: ["purchase_order_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "purchase_order_items_product_fk";
            columns: ["product_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_overview";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "purchase_order_items_product_fk";
            columns: ["product_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          cancelled_at: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          expected_date: string | null;
          id: string;
          notes: string | null;
          order_date: string;
          order_number: string;
          ordered_at: string | null;
          received_at: string | null;
          status: string;
          subtotal: number;
          supplier_id: string;
          tax_total: number;
          total: number;
          updated_at: string;
          warehouse_id: string;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          expected_date?: string | null;
          id?: string;
          notes?: string | null;
          order_date?: string;
          order_number: string;
          ordered_at?: string | null;
          received_at?: string | null;
          status?: string;
          subtotal?: number;
          supplier_id: string;
          tax_total?: number;
          total?: number;
          updated_at?: string;
          warehouse_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          expected_date?: string | null;
          id?: string;
          notes?: string | null;
          order_date?: string;
          order_number?: string;
          ordered_at?: string | null;
          received_at?: string | null;
          status?: string;
          subtotal?: number;
          supplier_id?: string;
          tax_total?: number;
          total?: number;
          updated_at?: string;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_fk";
            columns: ["supplier_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "purchase_orders_warehouse_fk";
            columns: ["warehouse_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          permission_key: string;
          role_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          permission_key: string;
          role_id: string;
        };
        Update: {
          created_at?: string;
          permission_key?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey";
            columns: ["permission_key"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          company_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_system: boolean;
          key: string;
          name: string;
          rank: number;
          scope: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          company_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key: string;
          name: string;
          rank?: number;
          scope?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key?: string;
          name?: string;
          rank?: number;
          scope?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_order_items: {
        Row: {
          company_id: string;
          created_at: string;
          description: string | null;
          discount_percent: number;
          id: string;
          line_discount: number;
          line_subtotal: number;
          line_tax: number;
          line_total: number;
          product_id: string;
          quantity: number;
          sales_order_id: string;
          sort_order: number;
          unit_price: number;
          updated_at: string;
          vat_rate: number;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          description?: string | null;
          discount_percent?: number;
          id?: string;
          line_discount?: number;
          line_subtotal: number;
          line_tax?: number;
          line_total: number;
          product_id: string;
          quantity: number;
          sales_order_id: string;
          sort_order?: number;
          unit_price: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          description?: string | null;
          discount_percent?: number;
          id?: string;
          line_discount?: number;
          line_subtotal?: number;
          line_tax?: number;
          line_total?: number;
          product_id?: string;
          quantity?: number;
          sales_order_id?: string;
          sort_order?: number;
          unit_price?: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sales_order_items_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_order_fk";
            columns: ["sales_order_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "sales_order_items_product_fk";
            columns: ["product_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_overview";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "sales_order_items_product_fk";
            columns: ["product_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      sales_orders: {
        Row: {
          amount_paid: number;
          cancelled_at: string | null;
          company_id: string;
          confirmed_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          customer_id: string | null;
          deleted_at: string | null;
          discount_total: number;
          due_date: string | null;
          fulfilled_at: string | null;
          id: string;
          notes: string | null;
          order_date: string;
          order_number: string;
          payment_status: string;
          status: string;
          subtotal: number;
          tax_total: number;
          total: number;
          updated_at: string;
          warehouse_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paid?: number;
          cancelled_at?: string | null;
          company_id: string;
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          discount_total?: number;
          due_date?: string | null;
          fulfilled_at?: string | null;
          id?: string;
          notes?: string | null;
          order_date?: string;
          order_number: string;
          payment_status?: string;
          status?: string;
          subtotal?: number;
          tax_total?: number;
          total?: number;
          updated_at?: string;
          warehouse_id: string;
        };
        Update: {
          amount_paid?: number;
          cancelled_at?: string | null;
          company_id?: string;
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          discount_total?: number;
          due_date?: string | null;
          fulfilled_at?: string | null;
          id?: string;
          notes?: string | null;
          order_date?: string;
          order_number?: string;
          payment_status?: string;
          status?: string;
          subtotal?: number;
          tax_total?: number;
          total?: number;
          updated_at?: string;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_orders_customer_fk";
            columns: ["customer_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "sales_orders_warehouse_fk";
            columns: ["warehouse_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      stock_levels: {
        Row: {
          company_id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
          warehouse_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          product_id: string;
          quantity?: number;
          updated_at?: string;
          warehouse_id: string;
        };
        Update: {
          company_id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_levels_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_levels_product_fk";
            columns: ["product_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_overview";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "stock_levels_product_fk";
            columns: ["product_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "stock_levels_warehouse_fk";
            columns: ["warehouse_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          balance_after: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          movement_type: string;
          note: string | null;
          product_id: string;
          quantity: number;
          reference_id: string | null;
          reference_type: string | null;
          transfer_group_id: string | null;
          unit_cost: number | null;
          warehouse_id: string;
        };
        ComputedFields: never;
        Insert: {
          balance_after: number;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          movement_type: string;
          note?: string | null;
          product_id: string;
          quantity: number;
          reference_id?: string | null;
          reference_type?: string | null;
          transfer_group_id?: string | null;
          unit_cost?: number | null;
          warehouse_id: string;
        };
        Update: {
          balance_after?: number;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          movement_type?: string;
          note?: string | null;
          product_id?: string;
          quantity?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          transfer_group_id?: string | null;
          unit_cost?: number | null;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_fk";
            columns: ["product_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "product_stock_overview";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "stock_movements_product_fk";
            columns: ["product_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "stock_movements_warehouse_fk";
            columns: ["warehouse_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          code: string;
          created_at: string;
          currency: string;
          description: string | null;
          features: NonNullable<Json>;
          id: string;
          is_active: boolean;
          is_public: boolean;
          max_employees: number | null;
          max_warehouses: number | null;
          name: string;
          price_monthly: number;
          price_yearly: number | null;
          sort_order: number;
          trial_days: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          is_public?: boolean;
          max_employees?: number | null;
          max_warehouses?: number | null;
          name: string;
          price_monthly: number;
          price_yearly?: number | null;
          sort_order?: number;
          trial_days?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          features?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          is_public?: boolean;
          max_employees?: number | null;
          max_warehouses?: number | null;
          name?: string;
          price_monthly?: number;
          price_yearly?: number | null;
          sort_order?: number;
          trial_days?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          billing_interval: string;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          company_id: string;
          created_at: string;
          currency: string;
          current_period_end: string | null;
          current_period_start: string;
          ended_at: string | null;
          id: string;
          plan_id: string;
          price: number;
          provider: string | null;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          status: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          billing_interval?: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          company_id: string;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          current_period_start?: string;
          ended_at?: string | null;
          id?: string;
          plan_id: string;
          price: number;
          provider?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          status: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          billing_interval?: string;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          company_id?: string;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          current_period_start?: string;
          ended_at?: string | null;
          id?: string;
          plan_id?: string;
          price?: number;
          provider?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          status?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address: string | null;
          business_number: string | null;
          city: string | null;
          company_id: string;
          contact_person: string | null;
          country_code: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          phone: string | null;
          updated_at: string;
          vat_number: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          business_number?: string | null;
          city?: string | null;
          company_id: string;
          contact_person?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Update: {
          address?: string | null;
          business_number?: string | null;
          city?: string | null;
          company_id?: string;
          contact_person?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
          vat_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suppliers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouses: {
        Row: {
          address: string | null;
          city: string | null;
          code: string;
          company_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_active: boolean;
          is_default: boolean;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          city?: string | null;
          code: string;
          company_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          code?: string;
          company_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      product_stock_overview: {
        Row: {
          barcode: string | null;
          category_id: string | null;
          company_id: string;
          created_at: string;
          default_warehouse_id: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          min_stock: number;
          name: string;
          needs_reorder: boolean | null;
          product_type: string;
          purchase_price: number;
          quantity: number | null;
          sale_price: number;
          sku: string;
          stock_status: string | null;
          stock_value: number | null;
          track_inventory: boolean;
          unit: string;
          updated_at: string;
          vat_rate: number;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "products_category_fk";
            columns: ["category_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "products_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_default_warehouse_fk";
            columns: ["default_warehouse_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
    };
    Functions: {
      apply_stock_movement: {
        Args: {
          p_company_id: string;
          p_delta: number;
          p_movement_type: string;
          p_note?: string;
          p_product_id: string;
          p_reference_id?: string;
          p_reference_type?: string;
          p_transfer_group_id?: string;
          p_unit_cost?: number;
          p_warehouse_id: string;
        };
        Returns: {
          balance_after: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          movement_type: string;
          note: string | null;
          product_id: string;
          quantity: number;
          reference_id: string | null;
          reference_type: string | null;
          transfer_group_id: string | null;
          unit_cost: number | null;
          warehouse_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "stock_movements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_company: {
        Args: {
          p_address?: string;
          p_business_number?: string;
          p_city?: string;
          p_name: string;
          p_phone?: string;
          p_plan_code?: string;
          p_vat_number?: string;
        };
        Returns: string;
      };
      dashboard_summary: { Args: { p_company_id: string }; Returns: Json };
      has_permission: { Args: { p_company_id: string; p_permission: string }; Returns: boolean };
      inventory_report: {
        Args: { p_category_id?: string; p_company_id: string; p_warehouse_id?: string };
        Returns: {
          category_name: string;
          cost_value: number;
          is_active: boolean;
          min_stock: number;
          name: string;
          product_id: string;
          purchase_price: number;
          quantity: number;
          retail_value: number;
          sale_price: number;
          sku: string;
          stock_status: string;
          total_quantity: number;
          unit: string;
        }[];
      };
      is_member: { Args: { p_company_id: string }; Returns: boolean };
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      log_activity: {
        Args: {
          p_action: string;
          p_company_id: string;
          p_entity_id?: string;
          p_entity_type?: string;
          p_metadata?: Json;
        };
        Returns: string;
      };
      log_login: {
        Args: { p_ip?: string; p_user_agent?: string; p_user_id: string };
        Returns: number;
      };
      member_role: { Args: { p_company_id: string }; Returns: string };
      my_permissions: { Args: { p_company_id: string }; Returns: string[] };
      next_document_number: { Args: { p_company_id: string; p_doc_type: string }; Returns: string };
      record_stock_count: {
        Args: {
          p_company_id: string;
          p_counted: number;
          p_note?: string;
          p_product_id: string;
          p_warehouse_id: string;
        };
        Returns: {
          balance_after: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          movement_type: string;
          note: string | null;
          product_id: string;
          quantity: number;
          reference_id: string | null;
          reference_type: string | null;
          transfer_group_id: string | null;
          unit_cost: number | null;
          warehouse_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "stock_movements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_stock_movement: {
        Args: {
          p_company_id: string;
          p_movement_type: string;
          p_note?: string;
          p_product_id: string;
          p_quantity: number;
          p_unit_cost?: number;
          p_warehouse_id: string;
        };
        Returns: {
          balance_after: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          movement_type: string;
          note: string | null;
          product_id: string;
          quantity: number;
          reference_id: string | null;
          reference_type: string | null;
          transfer_group_id: string | null;
          unit_cost: number | null;
          warehouse_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "stock_movements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      safe_inet: { Args: { p_value: string }; Returns: unknown };
      set_default_warehouse: {
        Args: { p_company_id: string; p_warehouse_id: string };
        Returns: undefined;
      };
      shares_company_with: { Args: { p_user_id: string }; Returns: boolean };
      slugify: { Args: { p_value: string }; Returns: string };
      transfer_stock: {
        Args: {
          p_company_id: string;
          p_from_warehouse_id: string;
          p_note?: string;
          p_product_id: string;
          p_quantity: number;
          p_to_warehouse_id: string;
        };
        Returns: string;
      };
      try_uuid: { Args: { p_value: string }; Returns: string };
      warehouse_stock_summary: {
        Args: { p_company_id: string };
        Returns: {
          product_count: number;
          quantity: number;
          stock_value: number;
          warehouse_id: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
