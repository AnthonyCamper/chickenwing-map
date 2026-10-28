import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import AppHeader from '../components/AppHeader'

export const LEGAL_CONTACT_EMAIL = 'anthonycap949@gmail.com'
export const LEGAL_LAST_UPDATED = '27 October 2026'

// Shared layout for the plain-language legal pages (/privacy, /terms).
export function LegalPage({ title, related, children }: {
  title: string
  /** The other legal page, linked at the bottom. */
  related: { to: string; label: string }
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      <Helmet>
        <title>{`${title} — WingKingTony`}</title>
      </Helmet>
      <AppHeader />
      <main className="w-full max-w-2xl mx-auto px-4 py-8 pb-safe-8">
        <p className="text-xs font-bold text-charcoal-600 bg-cream-100 border border-night-900/15 rounded-lg px-3 py-2 inline-block">
          Last updated {LEGAL_LAST_UPDATED}
        </p>
        <h1 className="font-display uppercase text-3xl sm:text-4xl text-night-900 tracking-tightest leading-none mt-4 mb-6">
          {title}
        </h1>
        <div className="space-y-6 text-sm text-charcoal-700 leading-relaxed break-words">
          {children}
        </div>
        <LegalFooter related={related} />
      </main>
    </div>
  )
}

// End of both legal pages: the other policy, how to reach us, and the way
// back into the app (people finish reading at the bottom, not the header).
function LegalFooter({ related }: { related: { to: string; label: string } }) {
  return (
    <div className="mt-10 pt-6 border-t-2 border-night-900/10 text-sm text-charcoal-700 space-y-3">
      <p>
        Read also: <Link to={related.to} className="inline-flex items-center min-h-[44px] px-1 text-sauce-500 font-bold underline">{related.label}</Link>
      </p>
      <p>Questions or requests: <ContactLink /></p>
      <Link to="/" className="btn-secondary">← Back to WingKingTony</Link>
    </div>
  )
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-extrabold text-base text-night-900">{heading}</h2>
      {children}
    </section>
  )
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

export function ContactLink() {
  // On a narrow screen, wrap at the "@" (the <wbr>), not mid-word.
  const [local, domain] = LEGAL_CONTACT_EMAIL.split('@')
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-sauce-500 font-bold underline break-words">
      {local}<wbr />@{domain}
    </a>
  )
}

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" related={{ to: '/terms', label: 'Terms of Use' }}>
      <p>
        WingKingTony is a small, free website where people rate chicken wing spots. It is run by
        one person, the site admin. This page explains, in plain words, what we collect, who can
        see it, and how to delete it. Questions: <ContactLink />.
      </p>

      <Section heading="What we collect">
        <Bullets items={[
          <><strong>Account details:</strong> your email address and password. Passwords are stored
            by our login provider (Supabase) in hashed form; we never see them.</>,
          <><strong>Google sign-in (optional):</strong> if you choose “Continue with Google”, Google
            gives us your email, your name and your Google profile photo.</>,
          <><strong>Profile:</strong> display name, a username (used in your profile link; it is made
            from your display name when you sign up, and you can change it in Edit profile), an
            optional profile photo and an optional short bio.</>,
          <><strong>What you post:</strong> reviews (spot, rating, flavor, size, visit date, text),
            photos, comments, GIFs you add to comments, likes and emoji reactions, people you
            follow, wing lists you make, and event RSVPs and check-ins.</>,
          <><strong>Spots you add:</strong> the name, address and map position of a wing spot.</>,
          <><strong>Notifications:</strong> your notification settings, and, only if you turn on
            push notifications, a push address for your browser or phone.</>,
        ]} />
        <p>
          We don’t use advertising or analytics trackers, and we don’t sell or share your data
          for marketing.
        </p>
      </Section>

      <Section heading="What is public">
        <p>Anyone, including people without an account, can see:</p>
        <Bullets items={[
          'your display name, username, profile photo and bio',
          'your reviews, review photos, comments and the spots you add',
          'your likes and reactions (in “liked by” lists), who you follow and who follows you',
          'your badges, and your wing lists (lists are public by default and show in the Lists tab; if you turn off “Public” on a list, only you can see it)',
          'your event RSVPs (on event pages); event check-ins are shown to signed-in members',
        ]} />
        <p>
          <strong>Your email address is never shown to other people.</strong> Only the site admin
          can see it, to manage accounts.
        </p>
        <p>
          The “Private profile” setting in your profile hides your profile page from other people
          and hides your name on event attendee lists and wing lists. Your reviews stay public and
          still show your name in the main feed and the People list.
        </p>
      </Section>

      <Section heading="Your location">
        <p>
          We don’t track your location and don’t save it to your account. Your browser always asks
          your permission first. We ask for it only for these features:
        </p>
        <Bullets items={[
          'the map’s “locate me” button and the “Near me” sort, to show spots near you;',
          'the “Show places near me” button in the review form’s spot search, to show nearby places first. If you tap it and allow it, an approximate area around you is sent to OpenStreetMap with your search.',
        ]} />
        <p>The address of a spot you review is public, like the rest of the review.</p>
      </Section>

      <Section heading="Other services we use">
        <Bullets items={[
          <><strong>Supabase</strong>: our database, login and photo storage. All account data and
            posts are stored there.</>,
          <><strong>GitHub Pages</strong>: hosts the website files.</>,
          <><strong>OpenStreetMap</strong>: map images, and the spot and address search (Nominatim).
            Your browser loads these directly, so OpenStreetMap sees your IP address and what you
            search for.</>,
          <><strong>Google Fonts</strong>: the fonts on the site. Your browser loads them from Google.</>,
          <><strong>Klipy</strong>: the GIF search in comments. When you open it, your search words
            are sent to Klipy.</>,
          <><strong>Google</strong>: if you use “Continue with Google”. Also, members who signed in
            with Google may have a profile photo stored by Google, so your browser loads those photos
            from Google’s servers when you see them.</>,
          <><strong>Your browser’s push service</strong> (for example Google, Apple or Mozilla):
            only if you turn on push notifications.</>,
        ]} />
      </Section>

      <Section heading="Stored on your device">
        <p>
          Your browser keeps your login session and a few settings (like the last map position or a
          half-written list) in its own storage on your device. We don’t use advertising cookies.
        </p>
      </Section>

      <Section heading="Keeping and deleting your data">
        <p>
          We keep your data while you have an account. You can edit or delete any review or comment
          at any time. To delete everything, tap your picture in the top corner → <strong>Edit
          profile</strong> and choose <strong>Delete account</strong>. This permanently removes your account,
          profile, reviews, photos, comments, likes, reactions, follows, lists, RSVPs, check-ins,
          badges and notifications. Spots you added stay on the map without your name.
        </p>
        <p>
          You can also email <ContactLink /> to ask for a copy of your data or to have it deleted.
        </p>
      </Section>

      <Section heading="Children">
        <p>WingKingTony is not meant for children under 13. Please don’t create an account if you are under 13.</p>
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes, we will update it here and change the date at the top. See also
          the <Link to="/terms" className="text-sauce-500 font-bold underline">Terms of Use</Link>.
        </p>
      </Section>
    </LegalPage>
  )
}
