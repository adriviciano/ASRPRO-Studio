import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { GuidedComponent } from './app/pages/guided/guided.component';
import './styles.css';

bootstrapApplication(window.location.pathname === '/avanzado' ? AppComponent : GuidedComponent).catch((error: unknown) => console.error(error));
