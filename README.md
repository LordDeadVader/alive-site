# Alive — Site Institucional

Site institucional da **Alive**, agência de criação de sites, design gráfico e identidade visual.

## ✨ Recursos

- **Design moderno dark/tech** com efeitos parallax, partículas animadas e reveal on scroll
- **100% responsivo** (desktop, tablet e mobile)
- **Área do Cliente** com login protegido por hash SHA-256
- **Painel de gestão de clientes**: cadastro, edição, filtros, busca e KPIs de pagamento (recebido, a receber, em atraso) — dados salvos no navegador via `localStorage`

## 📁 Estrutura

```
index.html       → site institucional (hero parallax, serviços, portfólio, planos, contato)
login.html       → área do cliente
dashboard.html   → painel de gestão de clientes e pagamentos
css/style.css    → design system completo
js/main.js       → parallax, partículas, animações
js/auth.js       → autenticação
js/dashboard.js  → CRUD de clientes
```

## 🚀 Como usar

Basta abrir o `index.html` no navegador ou hospedar em qualquer serviço de páginas estáticas (GitHub Pages, Netlify, Vercel).

> **Nota:** a autenticação é client-side, adequada para uso pessoal em página estática. Os dados dos clientes ficam armazenados apenas no navegador em que foram cadastrados.
