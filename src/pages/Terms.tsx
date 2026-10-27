import { Link } from 'react-router-dom'
import { Bullets, ContactLink, LegalPage, Section } from './Privacy'

export default function Terms() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        These are the rules for using WingKingTony, a free website for rating chicken wing spots.
        By creating an account or posting, you agree to them. They are written in plain words on
        purpose. Questions: <ContactLink />.
      </p>

      <Section heading="Your account">
        <Bullets items={[
          'Creating an account is free. You must be 13 or older.',
          'Use your real email address and keep your password to yourself. You are responsible for what is posted from your account.',
          'You can delete your account at any time from your profile (Profile → Delete account).',
        ]} />
      </Section>

      <Section heading="What you post">
        <Bullets items={[
          'Reviews, photos, comments and lists you post are public. Post only what you are happy for anyone to see.',
          'Be honest. Review places you actually visited, and share your own opinion.',
          'Only post photos you took or have the right to share. Don’t post photos of other people without their permission.',
          'You keep ownership of what you post. You give WingKingTony permission to show it on the site (for example in the feed, on spot pages and in share previews) for as long as it is on the site.',
        ]} />
      </Section>

      <Section heading="Not allowed">
        <Bullets items={[
          'harassment, hate, threats, or personal information about other people',
          'spam, ads, or fake reviews (including reviews of your own business or a competitor)',
          'illegal content, nudity, or anything that breaks someone else’s rights',
          'trying to break, overload or get around the site’s security',
        ]} />
        <p>
          The admin may edit or remove content, or suspend accounts, that break these rules.
        </p>
      </Section>

      <Section heading="Reviews are opinions">
        <p>
          Ratings and reviews are the personal opinions of the people who wrote them, not facts
          checked by WingKingTony. Spot details (name, address, map position) are added by members
          and may be wrong or out of date. Check with the restaurant before you go.
        </p>
      </Section>

      <Section heading="No guarantees">
        <p>
          WingKingTony is a hobby project, provided “as is”. It may change, have errors, or be
          unavailable at times, and features may be added or removed. To the extent the law allows,
          we are not responsible for losses that come from using the site.
        </p>
      </Section>

      <Section heading="Privacy">
        <p>
          How we handle your data is explained in the{' '}
          <Link to="/privacy" className="text-sauce-500 font-bold underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update these terms. When we do, we will change the date at the top of this page.
          If you keep using the site after that, the new terms apply.
        </p>
      </Section>
    </LegalPage>
  )
}
