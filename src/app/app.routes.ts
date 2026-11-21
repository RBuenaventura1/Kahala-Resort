import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        title: 'Kahala Resort',
        loadComponent: () => import('./home/home').then(m => m.Home)
    },
    {
        path: 'reserve/:roomId',
        title: 'Reserve your stay | Kahala',
        loadComponent: () =>
            import('./booking/reserve-page').then(m => m.ReservePage)
    },
    {
        path: 'my-reservations/:reservationId',
        title: 'Reservation details | Kahala',
        loadComponent: () =>
            import('./booking/reservations-page').then(m => m.ReservationsPage)
    },
    {
        path: 'my-reservations',
        title: 'My reservations | Kahala',
        loadComponent: () =>
            import('./booking/reservations-page').then(m => m.ReservationsPage)
    },
    {
        path: '**',
        redirectTo: ''
    }
];