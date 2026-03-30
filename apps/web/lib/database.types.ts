export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          created_at: string;
          major: string | null;
          year: number | null;
          interest_tags: string[];
          avatar_url: string | null;
          hosted_count: number;
          attendance_rate: number;
          expo_push_token: string | null;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
          major?: string | null;
          year?: number | null;
          interest_tags?: string[];
          avatar_url?: string | null;
          hosted_count?: number;
          attendance_rate?: number;
          expo_push_token?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
          major?: string | null;
          year?: number | null;
          interest_tags?: string[];
          avatar_url?: string | null;
          hosted_count?: number;
          attendance_rate?: number;
          expo_push_token?: string | null;
        };
      };
      events: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          start_time: string;
          end_time: string;
          location_text: string;
          location_lat: number | null;
          location_lng: number | null;
          capacity: number | null;
          description: string | null;
          status: "active" | "canceled";
          created_at: string;
          reminder_sent_at: string | null;
          image_url: string | null;
        };
        Insert: {
          id?: string;
          host_id: string;
          title: string;
          start_time: string;
          end_time: string;
          location_text: string;
          location_lat?: number | null;
          location_lng?: number | null;
          capacity?: number | null;
          description?: string | null;
          status?: "active" | "canceled";
          created_at?: string;
          reminder_sent_at?: string | null;
          image_url?: string | null;
        };
        Update: {
          id?: string;
          host_id?: string;
          title?: string;
          start_time?: string;
          end_time?: string;
          location_text?: string;
          location_lat?: number | null;
          location_lng?: number | null;
          capacity?: number | null;
          description?: string | null;
          status?: "active" | "canceled";
          created_at?: string;
          reminder_sent_at?: string | null;
          image_url?: string | null;
        };
      };
      event_members: {
        Row: {
          event_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          joined_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          message: string;
          screen: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          message: string;
          screen?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          message?: string;
          screen?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_event: {
        Args: { p_event_id: string };
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
