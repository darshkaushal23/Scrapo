export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

/**
 * Hand-written stand-in for `supabase gen types`.
 * Replace this file when a Supabase project exists.
 * Authorization roles belong in app_metadata, never in user-editable metadata.
 */
export type Database = {
  public: {
    Tables: {
      profiles: Table<{
        id: string;
        full_name: string;
        role: "donor" | "student" | "recycler" | "admin";
        city: string | null;
        points_month: number;
        points_lifetime: number;
        created_at: string;
      }>;
      devices: Table<{
        id: string;
        owner_id: string;
        category: string;
        brand: string;
        model: string;
        description: string;
        age_years: number;
        condition: string;
        working_status: string;
        estimated_value: number;
        points: number;
        status: string;
        created_at: string;
      }>;
      pickups: Table<{
        id: string;
        tracking_id: string;
        device_id: string;
        donor_id: string | null;
        recycler_id: string | null;
        address: string;
        city: string;
        collection_date: string | null;
        status: string;
        status_note: string | null;
        created_at: string;
      }>;
      pickup_addresses: Table<{
        pickup_id: string;
        address: string;
      }>;
      listings: Table<{
        id: string;
        device_id: string;
        student_price: number | null;
        donation_status: string;
        campus: string;
        note: string;
      }>;
      assistance_requests: Table<{
        id: string;
        student_id: string;
        category: string;
        need: string;
        campus: string;
        status: string;
      }>;
      assistance_board: Table<{
        id: string;
        category: string;
        need: string;
        campus: string;
        status: string;
      }>;
      listed_device_cards: Table<{
        id: string;
        category: string;
        brand: string;
        model: string;
        condition: string;
      }>;
      leaderboard_standings: Table<{
        id: string;
        full_name: string;
        city: string | null;
        points_month: number;
        points_lifetime: number;
      }>;
      reward_events: Table<{
        id: string;
        profile_id: string;
        device_id: string | null;
        reason: "device_donation" | "student_match";
        label: string;
        points: number;
        created_at: string;
      }>;
      recycler_profiles: Table<{
        id: string;
        profile_id: string;
        org_name: string;
        license: string;
        city: string;
        status: string;
      }>;
      monthly_winners: Table<{
        id: string;
        month: string;
        profile_id: string;
        rank: number;
        points: number;
        winner_name: string | null;
        winner_city: string | null;
        published: boolean;
      }>;
      pickup_events: Table<{
        id: string;
        pickup_id: string;
        status: string;
        note: string;
        happened_at: string;
      }>;
      organization_members: Table<{
        id: string;
        organization_id: string;
        profile_id: string;
        member_role: "owner" | "member";
        created_at: string;
      }>;
      organization_status_history: Table<{
        id: string;
        organization_id: string;
        status: string;
        changed_by: string | null;
        created_at: string;
      }>;
      pickup_decisions: Table<{
        id: string;
        pickup_id: string;
        organization_id: string;
        decision: "accepted" | "rejected";
        decided_by: string;
        created_at: string;
      }>;
      pickup_status_history: Table<{
        id: string;
        pickup_id: string;
        status: string;
        note: string;
        changed_by: string | null;
        created_at: string;
      }>;
      device_inspections: Table<{
        id: string;
        pickup_id: string;
        organization_id: string;
        inspector_id: string;
        notes: string;
        working_status: string;
        donation_ready: boolean;
        created_at: string;
      }>;
      processing_records: Table<{
        id: string;
        pickup_id: string;
        organization_id: string;
        status: string;
        note: string;
        recorded_by: string;
        created_at: string;
      }>;
      device_sanitisation_records: Table<{
        id: string;
        device_id: string;
        pickup_id: string;
        status: "pending" | "in_progress" | "completed" | "failed";
        method: string;
        technician_id: string | null;
        organization_id: string | null;
        completed_at: string | null;
        verification_evidence: string;
        verification_status: "pending_review" | "verified" | "rejected";
        verified_by: string | null;
        verified_at: string | null;
        notes: string;
        created_at: string;
      }>;
      device_custody_history: Table<{
        id: string;
        device_id: string;
        pickup_id: string;
        stage: string;
        action: string;
        responsible_user_id: string;
        responsible_role: string;
        responsible_org: string | null;
        notes: string;
        happened_at: string;
      }>;
    };
    Views: {
      leaderboard: {
        Row: {
          id: string;
          full_name: string;
          city: string | null;
          points_month: number;
          points_lifetime: number;
        };
        Relationships: [];
      };
      partner_monthly_stats: {
        Row: {
          organization_id: string;
          month: string;
          requests: number;
          collected: number;
          donated: number;
        };
        Relationships: [];
      };
      monthly_results: {
        Row: {
          month: string;
          rank: number;
          points: number;
          full_name: string;
          city: string | null;
        };
        Relationships: [];
      };
      request_status_history: {
        Row: {
          id: string;
          request_id: string;
          status: string;
          note: string;
          responsible_user: string | null;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
