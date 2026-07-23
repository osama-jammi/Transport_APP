import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth.guard';

import { DashboardComponent } from './features/dashboard.component';
import { VoyagesComponent } from './features/voyages.component';
import { VoyagesConteneursComponent } from './features/voyages-conteneurs.component';
import { FlotteComponent } from './features/flotte.component';
import { ChantiersComponent } from './features/chantiers.component';
import { ArticlesComponent } from './features/articles.component';
import { MatieresPremieresComponent } from './features/matieres-premieres.component';
import { DepotsComponent } from './features/depots.component';
import { StockComponent } from './features/stock.component';
import { SuiviTrajetsComponent } from './features/suivi-trajets.component';
import { AdministrationComponent } from './features/administration.component';
import { RapportsComponent } from './features/rapports.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard',  component: DashboardComponent,  canActivate: [AuthGuard] },
  { path: 'voyages',    component: VoyagesComponent,    canActivate: [AuthGuard] },
  { path: 'voyages-conteneurs', component: VoyagesConteneursComponent, canActivate: [AuthGuard] },
  { path: 'flotte',     component: FlotteComponent,     canActivate: [AuthGuard] },
  // Anciennes routes → Flotte (chauffeurs + camions combinés)
  { path: 'chauffeurs', redirectTo: 'flotte' },
  { path: 'camions',    redirectTo: 'flotte' },
  { path: 'chantiers',  component: ChantiersComponent,  canActivate: [AuthGuard] },
  { path: 'articles',   component: ArticlesComponent,   canActivate: [AuthGuard] },
  { path: 'matieres-premieres', component: MatieresPremieresComponent, canActivate: [AuthGuard] },
  { path: 'depots',     component: DepotsComponent,     canActivate: [AuthGuard] },
  { path: 'stock',      component: StockComponent,      canActivate: [AuthGuard] },
  { path: 'gps',        redirectTo: 'suivi-trajets' },
  { path: 'suivi-trajets', component: SuiviTrajetsComponent, canActivate: [AuthGuard] },
  { path: 'administration', component: AdministrationComponent, canActivate: [AuthGuard] },
  { path: 'rapports',   component: RapportsComponent,   canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
