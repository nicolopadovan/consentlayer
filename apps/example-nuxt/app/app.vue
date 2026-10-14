<template>
  <main>
    <nav>
      <NuxtLink to="/">Home</NuxtLink>
      <NuxtLink to="/shop?page=2">Shop</NuxtLink>
    </nav>
    <NuxtPage />
    <ClientOnly>
      <ConsentBanner privacy-policy-url="/privacy" />
      <CookieSettingsButton />
    </ClientOnly>
  </main>
</template>
