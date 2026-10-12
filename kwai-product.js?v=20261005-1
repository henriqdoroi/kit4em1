/* Kwai visual adapter. Reuses the live product, cart, variation and PIX handlers. */
( () => {
    'use strict';
    function init() {
        const q = s => document.querySelector(s);
        let mounted = false;
        const positions = [];
        const cartMarkup = q('#cartBtn')?.innerHTML;
        function remember(el) {
            if (el && !positions.some(x => x.el === el)) {
                const anchor = document.createComment('kwai-position');
                el.before(anchor);
                positions.push({
                    el,
                    anchor
                });
            }
        }
        function cleanup() {
            positions.forEach( ({el, anchor}) => anchor.after(el));
            document.querySelectorAll('#kwOffer,.kw-contact,.kw-gallery-ribbon').forEach(e => e.remove());
            if (cartMarkup && q('#cartBtn'))
                q('#cartBtn').innerHTML = cartMarkup;
            document.body.classList.remove('kwai-live');
            mounted = false;
        }
        const money = n => Number(n).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        function render() {
            if (document.body.dataset.theme !== 'kwai')
                return;
            const p = window.__PROD_ATUAL;
            if (!p)
                return;
            document.body.classList.add('kwai-live');
            const info = q('.product-info')
              , price = q('.price-section')
              , title = q('.title-wrapper');
            if (!info || !price)
                return;
            if (!mounted) {
                mounted = true;
                const variants = q('#varRow');
                if (variants) {
                    remember(variants);
                    price.after(variants);
                }
                const shipping = q('.product-info-static-image');
                if (shipping) {
                    remember(shipping);
                    shipping.classList.add('kw-shipping');
                    info.after(shipping);
                }
                const offer = document.createElement('div');
                offer.id = 'kwOffer';
                offer.className = 'kw-offer';
                offer.innerHTML = '<div><strong></strong><p>Desconto já incluído no preço</p></div><button type="button">Ver oferta</button>';
                offer.querySelector('button').onclick = () => window.onBuyNowClick?.();
                title.before(offer);
                const foot = q('.footer')
                  , contact = document.createElement('button');
                contact.className = 'footer-nav-btn kw-contact';
                contact.type = 'button';
                contact.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 19 2 22l1-7C-1 3 13-2 20 5c8 10-4 19-12 15Z"/><path d="M7 11h.1m5 0h.1m5 0h.1"/></svg><span>Contatar</span>';
                contact.onclick = () => {
                    const s = window.STORE_SETTINGS || {}
                      , phone = String(s.footer_whatsapp || s.whatsapp || '').replace(/\D/g, '');
                    if (phone) {
                        window.open('https://wa.me/' + (phone.startsWith('55') ? phone : '55' + phone), '_blank', 'noopener');
                        return;
                    }
                    const email = s.footer_email || s.contact_email;
                    if (email) {
                        location.href = 'mailto:' + email;
                        return;
                    }
                    q('.page-footer-container')?.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
                ;
                foot?.querySelector('.footer-nav-btn')?.after(contact);
                const cart = q('#cartBtn')
                  , topCart = q('#cartTopBtn svg');
                if (cart && topCart) {
                    const label = cart.querySelector('span');
                    if (label)
                        label.replaceWith(topCart.cloneNode(true));
                }
                const h = q('#description .section-title');
                if (h)
                    h.textContent = 'Descrição do produto';
                const storeHead = q('.ml-head h3');
                if (storeHead)
                    storeHead.textContent = 'Principais escolhas da loja';
                const banner = document.createElement('div');
                banner.className = 'kw-gallery-ribbon';
                banner.textContent = 'Confira as opções de entrega';
                q('.image-slider-container')?.append(banner);
            }
            const val = Number(String(p.currentPrice || 0).replace(',', '.'))
              , orig = Number(String(p.originalPrice || 0).replace(',', '.'));
            let prices = (p.variationGroups || []).flatMap(g => (g.options || []).map(o => Number(o.price)).filter(v => v > 0));
            const min = prices.length ? Math.min(...prices) : val
              , off = orig > min ? Math.round((1 - min / orig) * 100) : 0;
            const main = q('.price-main');
            if (main) {
                main.replaceChildren();
                if (off) {
                    const badge = document.createElement('span');
                    badge.className = 'price-off';
                    badge.textContent = '-' + off + '%';
                    main.append(badge);
                }
                main.append(document.createTextNode((prices.length ? 'A partir de ' : '') + money(min)));
            }
            const savings = q('.price-savings');
            if (savings)
                savings.textContent = p.salesCount ? String(p.salesCount) + ' vendidos' : 'Pagamento via PIX';
            const flash = q('.flash-deal-container');
            if (flash) {
                flash.innerHTML = '<b>Oferta do produto</b><span>Confira as condições</span>';
            }
            const offer = q('#kwOffer');
            offer.hidden = !off;
            if (off)
                offer.querySelector('strong').textContent = off + '% OFF';
            const installment = q('#installmentsRow');
            if (installment)
                installment.style.display = 'none';
            const coupons = q('#ofBloco');
            if (coupons)
                coupons.style.display = 'none';
            const titleBuy = q('#buyNowTitle');
            if (titleBuy)
                titleBuy.textContent = p.ctaText || 'Comprar agora';
            const rec = q('#recommendations');
            if (rec && rec.querySelector('.recommendations-grid')?.children.length) {
                remember(rec);
                info.after(rec);
                const h = rec.querySelector('h3');
                if (h)
                    h.textContent = 'Mais da loja';
            }
        }
        const original = window.loadProduct;
        if (original)
            window.loadProduct = function() {
                cleanup();
                const result = original.apply(this, arguments);
                render();
                return result;
            }
            ;
        new MutationObserver( () => {
            if (document.body.dataset.theme !== 'kwai')
                cleanup();
        }
        ).observe(document.body, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
        window.addEventListener('scroll', () => document.body.classList.toggle('kw-scrolled', scrollY > 80), {
            passive: true
        });
        render();
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
}
)();
