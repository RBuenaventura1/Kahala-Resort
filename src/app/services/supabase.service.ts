
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
      .select(
        'id, name, description, room_type, max_guests, price_per_night, image_url, amenities'
      )
      .eq('is_available', true)
      .order('price_per_night', { ascending: true });
  }

  async getExperiences() {
    return this.client
      .from('experiences')
      .select('id, title, description, price, image_url, duration')
      .eq('is_active', true)
      .order('title');
  }

  async getMyReservations(
    userId: string,
    page = 1,
    pageSize = 6
  ) {
    const from = (page - 1) * pageSize;

    return this.client
      .from('orders')
      .select(
        'id, room_id, check_in, check_out, guests, total_price, status, special_requests, created_at, rooms(name, room_type, image_url)',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
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

}
