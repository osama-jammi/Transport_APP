import { NgModule, APP_INITIALIZER } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { KeycloakAngularModule, KeycloakService } from 'keycloak-angular';
import { ToastrModule } from 'ngx-toastr';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { initializeKeycloak } from './core/keycloak-init';
import { TokenInterceptor } from './core/token.interceptor';

import { DashboardComponent } from './features/dashboard.component';
import { VoyagesComponent } from './features/voyages.component';
import { VoyagesConteneursComponent } from './features/voyages-conteneurs.component';
import { FlotteComponent } from './features/flotte.component';
import { ChantiersComponent } from './features/chantiers.component';
import { ArticlesComponent } from './features/articles.component';
import { MatieresPremieresComponent } from './features/matieres-premieres.component';
import { DepotsComponent } from './features/depots.component';
import { SuiviTrajetsComponent } from './features/suivi-trajets.component';
import { AdministrationComponent } from './features/administration.component';
import { RapportsComponent } from './features/rapports.component';
import { PaginatePipe } from './shared/paginate.pipe';
import { PaginatorComponent } from './shared/paginator.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    VoyagesComponent,
    VoyagesConteneursComponent,
    FlotteComponent,
    ChantiersComponent,
    ArticlesComponent,
    MatieresPremieresComponent,
    DepotsComponent,
    SuiviTrajetsComponent,
    AdministrationComponent,
    RapportsComponent,
    PaginatePipe,
    PaginatorComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    KeycloakAngularModule,
    ToastrModule.forRoot({ positionClass: 'toast-bottom-right', timeOut: 3500, progressBar: true })
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      multi: true,
      deps: [KeycloakService]
    },
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
