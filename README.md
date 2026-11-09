# Calculadora Cadeira Vazia — Cadeira Cheia

Landing pública + calculadora de ROI para clínicas odontológicas.
Publicada via **GitHub Pages** a partir deste repositório.

**Somente arquivos públicos.** Aqui ficam apenas `index.html`, `robots.txt`,
`sitemap.xml`, `assets/app.js`, `assets/styles.css` e `assets/img/` (foto do hero,
`og-image.jpg`, favicon e ilustrações SVG). Não copie para cá páginas internas
nem documentação comercial.

## Publicar / atualizar

Os arquivos aqui são uma **cópia** dos arquivos-fonte. O fonte mora no repositório
privado do projeto (`landing/index.html` e `landing/assets/`).

Depois de editar o fonte, rode no repositório privado:

```powershell
powershell -File landing\scripts\publish.ps1
```

O script copia os arquivos públicos, **apaga do repositório o que saiu da fonte**
(por exemplo, imagem substituída), commita e dá push — o GitHub Pages republica
sozinho em 1–2 minutos.

## SEO / compartilhamento

- `robots.txt` — indexa a home, bloqueia `respostas.html`, `simulador.html`,
  `data/` e `api/`, aponta o sitemap
- `sitemap.xml` — apenas a URL da home
- `og:image` (`assets/img/og-image.jpg`, 1200×630) — prévia do link no WhatsApp,
  Facebook e anúncios; meta tags `og:*`, `twitter:*` e `canonical` no `index.html`
- favicon SVG + apple-touch-icon

> **Ao mudar de domínio** (Vercel, domínio próprio): atualize a base
> `https://gfseass-sketch.github.io/cadeira-cheia-calculadora` nas meta tags do
> `index.html`, no `robots.txt` e no `sitemap.xml` do fonte.

## URLs

- Site: <https://gfseass-sketch.github.io/cadeira-cheia-calculadora/>
- Teste com outro WhatsApp: acrescente `?wa=5511999999999` na URL
