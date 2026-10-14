import type { Routes } from '@angular/router'
import { Home } from './home'
import { Shop } from './shop'

export const routes: Routes = [
  { path: '', component: Home, title: 'Home' },
  { path: 'shop', component: Shop, title: 'Shop' },
]
