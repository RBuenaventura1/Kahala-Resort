import {
  Component,
  effect,
  inject,
  signal
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrls: [
    './dashboard-layout.css',
    './kahala-theme.css'
  ],
  template: `
    <a class="skip-link" href="#dashboard-main">Skip to content</a>

    <div class="workspace">
      <header class="topbar">
        <button
          class="menu-button"
          type="button"
          aria-controls="dashboard-navigation"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen())"
        >
          Menu
        </button>

        <span class="workspace-name">Kahala · Your workspace</span>

        @if (supabase.user(); as user) {
          <span class="account-email">{{ user.email }}</span>

          <button
            type="button"
            [disabled]="signingOut()"
            (click)="signOut()"
          >
            {{ signingOut() ? 'Signing out…' : 'Sign out' }}
          </button>
        }
      </header>

      <aside
        id="dashboard-navigation"
        class="sidebar"
        [class.open]="menuOpen()"
      >
        <a class="brand" routerLink="/" aria-label="Kahala Resort home">
          <span class="brand-mark" aria-hidden="true">K</span>
          <span>
            KAHALA
            <small>RESORT &amp; RETREAT</small>
          </span>
        </a>

        <p class="nav-label">YOUR ACCOUNT</p>

        <nav aria-label="Dashboard navigation">
          <a
            routerLink="/dashboard"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            (click)="menuOpen.set(false)"
          >
            Overview
          </a>

          <a
            routerLink="/my-reservations"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            (click)="menuOpen.set(false)"
          >
            My reservations
          </a>

          <a routerLink="/" fragment="accommodations">
            Explore accommodations ↗
          </a>

          @if (isAdmin()) {
            <p class="nav-label">STAFF WORKSPACE</p>

            <a
              routerLink="/admin"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              (click)="menuOpen.set(false)"
            >
              Manage reservations
            </a>
          }
        </nav>

        <div class="sidebar-note">
          <p>Your next escape starts here.</p>
          <a routerLink="/">Return to resort website</a>
        </div>
      </aside>

      <main id="dashboard-main" tabindex="-1">
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        @if (!supabase.authReady()) {
          <p role="status">Checking your session…</p>
        } @else if (!supabase.user()) {
          <h1>Your Kahala account</h1>
          <p>Sign in to open your dashboard.</p>

          <a
            class="sign-in"
            routerLink="/"
            [queryParams]="{ login: '1', returnTo: router.url }"
          >
            Sign in
          </a>
        } @else {
          <router-outlet />
        }
      </main>
    </div>
  `
})
export class DashboardLayout {
  readonly supabase = inject(SupabaseService);
  readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly isAdmin = signal(false);
  readonly signingOut = signal(false);
  readonly error = signal('');

  constructor() {
    effect((onCleanup) => {
      const id = this.supabase.user()?.id;

      let active = true;
      onCleanup(() => { active = false; });

      this.isAdmin.set(false);

      if (!id) return;

      void this.supabase.checkAdminAccess()
        .then(allowed => {
          if (active) this.isAdmin.set(allowed);
        })
        .catch(error => {
          console.error('Admin navigation check failed:', error);
        });
    });
  }

  async signOut(): Promise<void> {
    if (this.signingOut()) return;

    this.signingOut.set(true);
    this.error.set('');

    try {
      const { error } = await this.supabase.signOut();

      if (error) throw error;

      await this.router.navigateByUrl('/');
    } catch {
      this.error.set('Unable to sign out. Please try again.');
    } finally {
      this.signingOut.set(false);
    }
  }
}