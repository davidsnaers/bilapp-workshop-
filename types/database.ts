export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "completed"
  | "cancelled_by_user"
  | "cancelled_by_workshop"
  | "auto_cancelled"
  | "no_show";

export type BookingMode = "day_based" | "time_based";
export type WorkshopStatus = "active" | "paused" | "onboarding";

export interface Workshop {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  booking_mode: BookingMode;
  parallel_slots: number;
  max_cars_per_day: number;
  allow_early_request: boolean;
  status: WorkshopStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkshopHours {
  id: string;
  workshop_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface Service {
  id: string;
  name_is: string;
  name_en: string;
  default_duration_minutes: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface WorkshopService {
  workshop_id: string;
  service_id: string;
  custom_duration_minutes: number | null;
  is_active: boolean;
  service?: Service;
}

export interface BookingWorkshop {
  id: string;
  workshop_id: string;
  user_id: string | null;
  car_id: string | null;
  service_id: string | null;
  service_label: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_plate: string | null;
  customer_car_make: string | null;
  customer_car_model: string | null;
  customer_car_year: number | null;
  start_time: string;
  duration_minutes: number;
  pending_until: string | null;
  status: BookingStatus;
  customer_notes: string | null;
  workshop_notes: string | null;
  decline_reason: string | null;
  source: "app" | "manual";
  created_at: string;
  updated_at: string;
  service?: Service;
}

export interface WorkshopBlock {
  id: string;
  workshop_id: string;
  start_datetime: string;
  end_datetime: string;
  reason: string | null;
  created_at: string;
}

// Type-safe Database interface for Supabase client
export interface Database {
  public: {
    Tables: {
      workshops: {
        Row: Workshop;
        Insert: Omit<Workshop, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Workshop, "id" | "created_at">>;
      };
      workshop_hours: {
        Row: WorkshopHours;
        Insert: Omit<WorkshopHours, "id">;
        Update: Partial<Omit<WorkshopHours, "id">>;
      };
      workshop_services: {
        Row: WorkshopService;
        Insert: WorkshopService;
        Update: Partial<WorkshopService>;
      };
      services: {
        Row: Service;
        Insert: Omit<Service, "id" | "created_at">;
        Update: Partial<Omit<Service, "id" | "created_at">>;
      };
      bookings_workshop: {
        Row: BookingWorkshop;
        Insert: Omit<BookingWorkshop, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BookingWorkshop, "id" | "created_at">>;
      };
      workshop_blocks: {
        Row: WorkshopBlock;
        Insert: Omit<WorkshopBlock, "id" | "created_at">;
        Update: Partial<Omit<WorkshopBlock, "id" | "created_at">>;
      };
    };
    Views: {
      pending_bookings_needing_action: {
        Row: BookingWorkshop & {
          workshop_name: string;
          owner_id: string;
          minutes_remaining: number;
        };
      };
    };
  };
}
