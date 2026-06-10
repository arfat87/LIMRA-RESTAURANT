import React from 'react';
import { Phone, MapPin, Clock, ExternalLink } from 'lucide-react';

export const StoreInfo: React.FC = () => (
  <section className="bg-gray-50 border-t border-gray-100 py-16">
    <div className="max-w-7xl mx-auto px-4">
      <div className="text-center mb-10">
        <h2 className="font-poppins font-bold text-2xl text-midnight mb-2">Visit Our Store</h2>
        <p className="text-gray-500 text-sm">Come say hello — we're in the heart of Ranchi</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Map */}
        <div className="rounded-2xl overflow-hidden shadow-card h-72 bg-gray-200">
          <iframe
            title="DSLR WORLD Store Location"
            src={`https://maps.google.com/maps?q=DSLR+WORLD+RR+Plaza+Ranchi+Jharkhand&output=embed`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full"
          />
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div>
            <h3 className="font-poppins font-bold text-xl text-midnight mb-1">DSLR WORLD</h3>
            <p className="font-devanagari text-accent text-base">डीएसएलआर वर्ल्ड</p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm mb-0.5">Address</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  RR Plaza, Church Rd, near Karbala Chowk,<br />
                  Lower Bazaar, Ranchi, Jharkhand 834001
                </p>
                <a
                  href="https://maps.google.com/?q=DSLR+WORLD+Ranchi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent text-xs font-semibold mt-1 hover:underline"
                >
                  Get Directions <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm mb-0.5">Phone</p>
                <a href="tel:06202381019" className="text-gray-600 text-sm hover:text-accent transition-colors">
                  062023 81019
                </a>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-accent" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm mb-1">Store Hours</p>
                <div className="space-y-1">
                  {[
                    { day: 'Monday – Saturday', hours: '10:00 AM – 8:00 PM' },
                    { day: 'Sunday', hours: '11:00 AM – 6:00 PM' },
                  ].map(({ day, hours }) => (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="text-gray-600">{day}</span>
                      <span className="font-medium text-gray-800">{hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-700 text-sm font-medium">Currently Open</span>
            <span className="text-emerald-600 text-sm">· Closing at 8:00 PM today</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);
