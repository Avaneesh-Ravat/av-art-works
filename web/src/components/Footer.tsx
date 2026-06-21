export function Footer() {
  return (
    <footer id="contact" className="mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h3 className="font-display text-lg font-bold text-brand-700">AV Art Works</h3>
          <p className="mt-2 text-sm text-stone-500">
            Handcrafted resin, texture, acrylic and customized paintings, made with love in India.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-stone-700">Contact</h4>
          <ul className="mt-2 space-y-1 text-sm text-stone-500">
            <li>hello@avartworks.in</li>
            <li>+91 98765 43210</li>
            <li>Bengaluru, India</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-stone-700">Follow</h4>
          <ul className="mt-2 space-y-1 text-sm text-stone-500">
            <li><a className="hover:text-brand-700" href="#">Instagram</a></li>
            <li><a className="hover:text-brand-700" href="#">Facebook</a></li>
            <li><a className="hover:text-brand-700" href="#">Pinterest</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-100 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} AV Art Works. All rights reserved.
      </div>
    </footer>
  );
}
