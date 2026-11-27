import { Reservation } from '../booking/booking.models';

export type ReservationStatus = Reservation['status'];

export interface AdminReservation {
  id: string;
  room_id: string;
  room_name: string | null;
  full_name: string | null;
  phone: string | null;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  status: ReservationStatus;
  special_requests: string | null;
  created_at: string;
}

export interface AdminReservationPage {
  items: AdminReservation[];
  total: number;
}