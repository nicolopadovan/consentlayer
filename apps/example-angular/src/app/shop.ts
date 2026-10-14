import { Component, input, numberAttribute } from '@angular/core'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'app-shop',
  imports: [RouterLink],
  template: `
    <section>
      <h1>Shop</h1>
      <a routerLink="/shop" [queryParams]="{ page: page() + 1 }">Next page</a>
      <button type="button" (click)="fail()">Throw an error</button>
    </section>
  `,
})
export class Shop {
  readonly page = input(1, { transform: numberAttribute })

  fail(): void {
    throw new Error('Shop failed')
  }
}
