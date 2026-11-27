import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SupabaseService } from '../services/supabase.service';
import {
  money,
  nightsBetween,
  Reservation,
  stayDate
} from './booking.models';

@Component({
  selector: 'app-reservations-page',
  imports: [RouterLink],
  styleUrls: [
    './booking.css',
    '../dashboard/dashboard-content.css',
    '../dashboard/kahala-theme.css'
  ],
  template: `
  
<section aria-label="Your reservations">

-      <h1>{{ reservationId() ? 'Reservation details' : 'My reservations' }}</h1>

      @if (!supabase.authReady()) {
        <p role="status">Checking your session…</p>
      } @else if (!supabase.user()) {
        <p>Sign in to view your reservation history.</p>
        <a
          class="action"
          routerLink="/"
          [queryParams]="{ login: '1', returnTo: router.url }"
        >
          Sign in
        </a>
      } @else {
        @if (loading()) {
          <p role="status">Loading reservations…</p>
        }

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
          <button type="button" (click)="refresh()">Try again</button>
        }

        @if (!loading() && !error()) {
          @if (reservationId()) {
            <p><a routerLink="/my-reservations">← All my reservations</a></p>

            @if (detail(); as booking) {
              <div class="layout">
                <article class="panel">
                  <h2>{{ booking.room?.name || 'Reserved accommodation' }}</h2>

                  @if (booking.room; as room) {
                    @if (room.image_url) {
                      <img
                        class="photo"
                        [src]="room.image_url"
                        [alt]="room.name"
                      />
                    }

                    <p>{{ room.description }}</p>
                    <p>{{ room.room_type }} · Up to {{ room.max_guests }} guests</p>

                    <h2>Current amenities</h2>
                    <ul>
                      @for (amenity of room.amenities; track $index) {
                        <li>{{ amenity }}</li>
                      } @empty {
                        <li>No amenity details listed.</li>
                      }
                    </ul>
                  } @else {
                    <p>Room details are currently unavailable.</p>
                  }
                </article>

                <section class="panel" aria-labelledby="summaryTitle">
                  <h2 id="summaryTitle">Booking summary</h2>
                  <p class="reference">Reference: {{ booking.id }}</p>
                  <p class="status">{{ status(booking.status) }}</p>

                  @if (booking.status === 'pending') {
                    <p>Your request is awaiting confirmation.</p>
                  }

                  <dl>
                    <div>
                      <dt>Check-in</dt>
                      <dd>{{ stayDate(booking.check_in) }}</dd>
                    </div>
                    <div>
                      <dt>Check-out</dt>
                      <dd>{{ stayDate(booking.check_out) }}</dd>
                    </div>
                    <div>
                      <dt>Nights</dt>
                      <dd>{{ nightsBetween(booking.check_in, booking.check_out) }}</dd>
                    </div>
                    <div>
                      <dt>Guests</dt>
                      <dd>{{ booking.guests }}</dd>
                    </div>
                    <div>
                      <dt>Recorded booking total</dt>
                      <dd><strong>{{ money(booking.total_price) }}</strong></dd>
                    </div>
                    <div>
                      <dt>Requested on</dt>
                      <dd>{{ stayDate(booking.created_at.slice(0, 10)) }} (UTC)</dd>
                    </div>
                  </dl>

                  <h2>Special requests</h2>
                  <p class="request">{{ booking.special_requests || 'None' }}</p>
                </section>
              </div>
            } @else {
              <p>This reservation was not found or is unavailable to your account.</p>
            }
          } @else {
            <p>{{ total() }} reservation requests</p>

            <div class="grid">
              @for (booking of reservations(); track booking.id) {
                <article class="panel">
                  <h2>{{ booking.room?.name || 'Reserved accommodation' }}</h2>
                  <p class="status">{{ status(booking.status) }}</p>
                  <p>
                    {{ stayDate(booking.check_in) }}
                    — {{ stayDate(booking.check_out) }}
                  </p>
                  <p>{{ booking.guests }} guests · {{ money(booking.total_price) }}</p>
                  <a
                    class="action"
                    [routerLink]="['/my-reservations', booking.id]"
                  >
                    View details
                  </a>
                </article>
              } @empty {
                <p>You don’t have any reservation requests yet.</p>
              }
            </div>
          }
        }

        @if (!reservationId() && totalPages() > 1) {
          <nav class="pagination" aria-label="Reservation pages">
            <button
              type="button"
              [disabled]="loading() || page() <= 1"
              (click)="goToPage(page() - 1)"
            >
              Previous
            </button>

            <span role="status" aria-live="polite">
              Page {{ page() }} of {{ totalPages() }}
            </span>

            <button
              type="button"
              [disabled]="loading() || page() >= totalPages()"
              (click)="goToPage(page() + 1)"
            >
              Next
            </button>
          </nav>
        }
      }
    </section>
  `
})
export class ReservationsPage {
  readonly supabase = inject(SupabaseService);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap
  });

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap
  });

  private readonly reload = signal(0);

  readonly reservationId = computed(() =>
    this.params().get('reservationId')
  );

  readonly page = computed(() => {
    const value = Number(this.query().get('page') ?? 1);
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  });

  readonly pageSize = 6;
  readonly reservations = signal<Reservation[]>([]);
  readonly detail = signal<Reservation | null>(null);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize))
  );

  readonly money = money;
  readonly stayDate = stayDate;
  readonly nightsBetween = nightsBetween;

  readonly status = (value: string): string =>
    value.replace(/_/g, ' ');

  constructor() {
    effect((onCleanup) => {
      const userId = this.supabase.user()?.id;
      const id = this.reservationId();
      const page = this.page();
      this.reload();

      let active = true;
      onCleanup(() => { active = false; });

      this.reservations.set([]);
      this.detail.set(null);
      this.error.set('');
      this.total.set(0);
      this.loading.set(!!userId);

      if (!userId) return;

      const load = async (): Promise<void> => {
        try {
          if (id) {
            const result = await this.supabase.getMyReservation(userId, id);

            if (!active) return;
            if (result.error) throw result.error;

            this.detail.set(result.data);
          } else {
            const result = await this.supabase.getMyReservations(
              userId,
              page,
              this.pageSize
            );

            if (!active) return;
            if (result.error) throw result.error;

            const count = result.count ?? 0;
            const lastPage = Math.max(1, Math.ceil(count / this.pageSize));
            this.total.set(count);

            if (page > lastPage) {
              await this.router.navigate(['/my-reservations'], {
                queryParams: { page: lastPage },
                replaceUrl: true
              });
              return;
            }

            this.reservations.set(result.data ?? []);
          }
        } catch (error: unknown) {
          if (!active) return;

          console.error('Reservation loading failed:', error);
          this.error.set('Unable to load reservations. Please try again.');
        } finally {
          if (active) this.loading.set(false);
        }
      };

      void load();
    });
  }

  goToPage(page: number): void {
    if (this.loading() || page < 1 || page > this.totalPages()) return;

    void this.router.navigate(['/my-reservations'], {
      queryParams: { page }
    });
  }

  refresh(): void {
    this.reload.update(value => value + 1);
  }
}