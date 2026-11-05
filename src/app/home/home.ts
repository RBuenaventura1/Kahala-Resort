
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';

interface Room {
    id: string;
    name: string;
    description: string;
    room_type: string;
    max_guests: number;
    price_per_night: number;
    image_url: string | null;
    amenities: string[];
}

interface Experience {
    id: string;
    title: string;
    description: string;
    price: number;
    image_url: string | null;
    duration: string | null;
}

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './home.html',
    styleUrl: './home.css'
})

export class Home implements OnInit {
    private supabase = inject(SupabaseService);
    private cdr = inject(ChangeDetectorRef);

    rooms: Room[] = [];
    experiences: Experience[] = [];

    loadingRooms = true;
    loadingExperiences = true;
    connectionMessage = '';

    mobileMenuOpen = false;
    selectedRoom: Room | null = null;

    checkIn = '';
    checkOut = '';
    guests = 2;
    specialRequests = '';

    signedIn = false;
    userEmail = '';
    busy = false;
    notice = '';
    noticeType: 'success' | 'error' = 'success';

    authMode: 'login' | 'register' = 'login';
    showAuth = false;
    authName = '';
    authEmail = '';
    authPassword = '';

    async ngOnInit(): Promise<void> {
        await Promise.all([
            this.loadRooms(),
            this.loadExperiences(),
            this.checkSession()
        ]);

        const today = new Date();
        this.checkIn = this.toDateInput(today);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.checkOut = this.toDateInput(tomorrow);

        this.supabase.client.auth.onAuthStateChange((_event, session) => {
            this.signedIn = !!session?.user;
            this.userEmail = session?.user?.email ?? '';
        });
    }

    private toDateInput(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async loadRooms(): Promise<void> {
        this.loadingRooms = true;
        const { data, error } = await this.supabase.getRooms();

        if (error) {
            console.error('Room loading error:', error.message);
            this.connectionMessage = 'Unable to load rooms. Check your Supabase configuration and database policies.';
            this.rooms = [];
        } else {
            this.rooms = (data ?? []) as Room[];
            this.connectionMessage = '';
        }

        this.loadingRooms = false;
    }

    async loadExperiences(): Promise<void> {
        this.loadingExperiences = true;
        const { data, error } = await this.supabase.getExperiences();

        if (error) {
            console.error('Experience loading error:', error.message);
            this.experiences = [];
        } else {
            this.experiences = (data ?? []) as Experience[];
        }

        this.loadingExperiences = false;
    }

    async checkSession(): Promise<void> {
        const user = await this.supabase.getCurrentUser();
        this.signedIn = !!user;
        this.userEmail = user?.email ?? '';
    }

    scrollTo(id: string): void {
        document.getElementById(id)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        this.mobileMenuOpen = false;
    }

    chooseRoom(room: Room): void {
        this.selectedRoom = room;
        this.scrollTo('reservation');
    }

    get nights(): number {
        if (!this.checkIn || !this.checkOut) return 0;

        const start = new Date(`${this.checkIn}T00:00:00`);
        const end = new Date(`${this.checkOut}T00:00:00`);
        const difference = end.getTime() - start.getTime();

        return difference > 0
            ? Math.round(difference / 86400000)
            : 0;
    }

    get estimatedTotal(): number {
        return this.selectedRoom
            ? Number(this.selectedRoom.price_per_night) * this.nights
            : 0;
    }

    formatPrice(value: number): string {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            maximumFractionDigits: 0
        }).format(Number(value));
    }

    async submitReservation(): Promise<void> {
        this.notice = '';

        if (!this.selectedRoom) {
            this.showNotice('Please select a room first.', 'error');
            return;
        }

        if (!this.checkIn || !this.checkOut || this.nights < 1) {
            this.showNotice('Please choose valid check-in and check-out dates.', 'error');
            return;
        }

        if (new Date(`${this.checkIn}T00:00:00`) < new Date(`${this.toDateInput(new Date())}T00:00:00`)) {
            this.showNotice('Check-in cannot be in the past.', 'error');
            return;
        }

        if (this.guests < 1 || this.guests > this.selectedRoom.max_guests) {
            this.showNotice(`This room allows up to ${this.selectedRoom.max_guests} guests.`, 'error');
            return;
        }

        const user = await this.supabase.getCurrentUser();

        if (!user) {
            this.showAuth = true;
            this.authMode = 'login';
            this.showNotice('Please log in before making a reservation.', 'error');
            return;
        }

        this.busy = true;

        const { error } = await this.supabase.createReservation({
            roomId: this.selectedRoom.id,
            checkIn: this.checkIn,
            checkOut: this.checkOut,
            guests: this.guests,
            specialRequests: this.specialRequests
        });

        this.busy = false;

        if (error) {
            this.showNotice(error.message, 'error');
            return;
        }

        this.showNotice('Reservation submitted successfully! You can view it in your customer dashboard once that page is implemented.', 'success');
        this.specialRequests = '';
        this.selectedRoom = null;
        await this.loadRooms();
    }

    openAuth(mode: 'login' | 'register'): void {
        this.authMode = mode;
        this.showAuth = true;
        this.notice = '';
    }


    async submitAuth(): Promise<void> {
        if (this.busy) return;

        this.notice = '';

        const email = this.authEmail.trim();
        const password = this.authPassword;
        const fullName = this.authName.trim();
        const isRegistering = this.authMode === 'register';

        if (!email || !password) {
            this.showNotice('Enter your email and password.', 'error');
            return;
        }

        if (isRegistering && !fullName) {
            this.showNotice('Enter your full name.', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotice(
                'Your password must be at least 6 characters long.',
                'error'
            );
            return;
        }

        this.busy = true;

        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
            const authRequest = isRegistering
                ? this.supabase.signUp(email, password, fullName)
                : this.supabase.signIn(email, password);

            const timeout = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(
                        'The authentication request took too long. Check your connection and try again.'
                    ));
                }, 20000);
            });

            const result = await Promise.race([authRequest, timeout]);

            if (result.error) {
                console.error('Authentication error:', result.error);

                if (
                    result.error.status === 429 ||
                    /rate limit|too many requests/i.test(result.error.message)
                ) {
                    this.showNotice(
                        'Too many requests. Please wait before trying again.',
                        'error'
                    );
                } else {
                    this.showNotice(result.error.message, 'error');
                }

                return;
            }

            if (isRegistering && !result.data.session) {
                this.showAuth = false;
                this.authPassword = '';

                this.showNotice(
                    'Account created. Please check your email if confirmation is required.',
                    'success'
                );
                return;
            }

            this.signedIn = !!result.data.user;
            this.userEmail = result.data.user?.email ?? email;

            // Close the modal immediately after successful authentication.
            this.showAuth = false;
            this.authPassword = '';
            this.busy = false;

            this.showNotice(
                isRegistering
                    ? 'Welcome to Kahala! Your account has been created.'
                    : 'Welcome back!',
                'success'
            );
        } catch (error: unknown) {
            console.error('Authentication request failed:', error);

            this.showNotice(
                error instanceof Error
                    ? error.message
                    : 'Authentication failed. Please try again later.',
                'error'
            );
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }

            this.busy = false;
            this.cdr.detectChanges();
        }
    }


    async signOut(): Promise<void> {
        const { error } = await this.supabase.signOut();

        if (error) {
            this.showNotice(error.message, 'error');
            return;
        }

        this.signedIn = false;
        this.userEmail = '';
        this.showNotice('You have signed out.', 'success');
    }

    showNotice(message: string, type: 'success' | 'error'): void {
        this.notice = message;
        this.noticeType = type;
    }

    get toDateInputForTemplate(): string {
        return this.toDateInput(new Date());
    }
}
