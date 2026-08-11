export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      application_status_events: {
        Row: {
          application_id: string;
          changed_at: string;
          created_at: string;
          id: string;
          status: Database["public"]["Enums"]["application_status"];
        };
        Insert: {
          application_id: string;
          changed_at?: string;
          created_at?: string;
          id?: string;
          status: Database["public"]["Enums"]["application_status"];
        };
        Update: {
          application_id?: string;
          changed_at?: string;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["application_status"];
        };
        Relationships: [
          {
            foreignKeyName: "application_status_events_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          application_date: string;
          city: string | null;
          company: string;
          country: string | null;
          created_at: string;
          id: string;
          job_type: string | null;
          notes: string | null;
          position: string;
          priority: boolean;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
          user_id: string;
          website: string | null;
        };
        Insert: {
          application_date?: string;
          city?: string | null;
          company: string;
          country?: string | null;
          created_at?: string;
          id?: string;
          job_type?: string | null;
          notes?: string | null;
          position: string;
          priority?: boolean;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
          user_id: string;
          website?: string | null;
        };
        Update: {
          application_date?: string;
          city?: string | null;
          company?: string;
          country?: string | null;
          created_at?: string;
          id?: string;
          job_type?: string | null;
          notes?: string | null;
          position?: string;
          priority?: boolean;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
          user_id?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          nickname: string | null;
          time_zone: string | null;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          nickname?: string | null;
          time_zone?: string | null;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          nickname?: string | null;
          time_zone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_applications: {
        Row: {
          application_id: string;
          created_at: string;
          task_id: string;
        };
        Insert: {
          application_id: string;
          created_at?: string;
          task_id: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_applications_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_applications_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          created_at: string;
          done: boolean;
          due_date: string | null;
          id: string;
          priority: boolean;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          done?: boolean;
          due_date?: string | null;
          id?: string;
          priority?: boolean;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          done?: boolean;
          due_date?: string | null;
          id?: string;
          priority?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      application_status: "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      application_status: ["applied", "interviewing", "offer", "rejected", "withdrawn"],
    },
  },
} as const;
