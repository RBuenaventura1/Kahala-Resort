
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser();

    if (error) {
      return null;
    }

    return data.user;
  }

  async signUp(
    email: string,
    password: string,
    fullName: string
  ) {
    return this.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
  }

  async signIn(email: string, password: string) {
    return this.client.auth.signInWithPassword({
      email,
      password
    });
  }

  async signOut() {
    return this.client.auth.signOut();
  }

  async getProfile(userId: string) {
    return this.client
      .from('profiles')
      .select('id, full_name, phone, role, created_at')
      .eq('id', userId)
      .single();
  }

  async getRooms() {
    return this.client
      .from('rooms')
      .select('*')
      .eq('is_available', true)
      .order('price_per_night', { ascending: true });
  }

  async getExperiences() {
    return this.client
      .from('experiences')
      .select('*')
      .eq('is_active', true)
      .order('title');
  }

  async getMyReservations() {
    return this.client
      .from('orders')
      .select('*, rooms(name, image_url, room_type)')
      .order('created_at', { ascending: false });
  }

  async createReservation(details: {
    roomId: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    specialRequests?: string;
  }) {
    return this.client.rpc('create_reservation', {
      p_room_id: details.roomId,
      p_check_in: details.checkIn,
      p_check_out: details.checkOut,
      p_guests: details.guests,
      p_special_requests: details.specialRequests || null
    });
  }

  async getAllReservations() {
    return this.client
      .from('orders')
      .select('*, profiles(full_name), rooms(name)')
      .order('created_at', { ascending: false });
  }

  async updateReservationStatus(
    reservationId: string,
    status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  ) {
    return this.client
      .from('orders')
      .update({ status })
      .eq('id', reservationId);
  }
}
