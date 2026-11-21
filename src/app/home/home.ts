import {
    ChangeDetectorRef,
    Component,
    DestroyRef,
    OnInit,
    inject
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { money, Room } from '../booking/booking.models';

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
    imports: [NgIf, NgFor, FormsModule, RouterLink],
    templateUrl: './home.html',
    styleUrl: './home.css'
})
export class Home implements OnInit {
    private readonly supabase = inject(SupabaseService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly destroyRef = inject(DestroyRef);

    rooms: Room[] = [];
    experiences: Experience[] = [];

    loadingRooms = true;
    loadingExperiences = true;
    connectionMessage = '';
    mobileMenuOpen = false;

    busy = false;
    notice = '';
    noticeType: 'success' | 'error' = 'success';

    authMode: 'login' | 'register' = 'login';
    showAuth = false;
    authName = '';
    authEmail = '';
    authPassword = '';

    readonly formatPrice = money;

    get signedIn(): boolean {
        return !!this.supabase.user();
    }

    ngOnInit(): void {
        if (this.route.snapshot.queryParamMap.get('login') === '1') {
            this.openAuth('login');
        }

        void this.loadContent();
    }

    private async loadContent(): Promise<void> {
        await Promise.allSettled([
            this.loadRooms(),
            this.loadExperiences()
        ]);

        if (!this.destroyRef.destroyed) {
            this.cdr.detectChanges();
        }
    }

    private async loadRooms(): Promise<void> {
        try {
            const { data, error } = await this.supabase.getRooms();
            if (error) throw error;
            this.rooms = data ?? [];
        } catch (error: unknown) {
            console.error('Room loading failed:', error);
            this.connectionMessage = 'Unable to load rooms. Please try again later.';
        } finally {
            this.loadingRooms = false;
        }
    }

    private async loadExperiences(): Promise<void> {
        try {
            const { data, error } = await this.supabase.getExperiences();
            if (error) throw error;
            this.experiences = data ?? [];
        } catch (error: unknown) {
            console.error('Experience loading failed:', error);
        } finally {
            this.loadingExperiences = false;
        }
    }

    scrollTo(id: string): void {
        document.getElementById(id)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
        this.mobileMenuOpen = false;
    }

    chooseRoom(room: Room): void {
        void this.router.navigate(['/reserve', room.id]);
    }

    openAuth(mode: 'login' | 'register'): void {
        this.authMode = mode;
        this.showAuth = true;
        this.notice = '';
    }

    async submitAuth(): Promise<void> {
        if (this.busy) return;

        const email = this.authEmail.trim();
        const password = this.authPassword;
        const fullName = this.authName.trim();
        const registering = this.authMode === 'register';

        if (!email || !password || (registering && !fullName)) {
            this.showNotice('Complete the required fields.', 'error');
            return;
        }

        if (registering && password.length < 6) {
            this.showNotice('Use a password of at least 6 characters.', 'error');
            return;
        }

        this.busy = true;

        try {
            const result = registering
                ? await this.supabase.signUp(email, password, fullName)
                : await this.supabase.signIn(email, password);

            if (result.error) {
                this.showNotice(
                    result.error.status === 429
                        ? 'Too many requests. Please wait before trying again.'
                        : 'Unable to sign in or register. Check your details and try again.',
                    'error'
                );
                return;
            }

            this.authPassword = '';
            this.showAuth = false;

            if (!result.data.session) {
                this.showNotice(
                    'Check your email to confirm your account, then sign in.',
                    'success'
                );
                return;
            }

            this.showNotice('You are signed in.', 'success');

            const returnTo = this.route.snapshot.queryParamMap.get('returnTo');

            // Accept only the booking routes created by this application.
            if (
                returnTo &&
                /^\/(?:reserve\/[a-f0-9-]+|my-reservations(?:\/[a-f0-9-]+)?)(?:\?page=\d+)?$/i
                    .test(returnTo)
            ) {
                await this.router.navigateByUrl(returnTo);
            }
        } catch (error: unknown) {
            console.error('Authentication failed:', error);
            this.showNotice('Unable to authenticate. Please try again.', 'error');
        } finally {
            this.busy = false;

            if (!this.destroyRef.destroyed) {
                this.cdr.detectChanges();
            }
        }
    }

    async signOut(): Promise<void> {
        try {
            const { error } = await this.supabase.signOut();
            if (error) throw error;
            this.showNotice('You have signed out.', 'success');
        } catch {
            this.showNotice('Unable to sign out. Please try again.', 'error');
        } finally {
            if (!this.destroyRef.destroyed) {
                this.cdr.detectChanges();
            }
        }
    }

    showNotice(message: string, type: 'success' | 'error'): void {
        this.notice = message;
        this.noticeType = type;
    }
}