import Layout from "../components/Layout";
import theme from "../components/theme";

export default function PrivacyPage() {
  return (
    <Layout title="Privacy Policy">
      <div style={styles.wrap}>
        <p style={styles.label}>HAIIC POLICY</p>
        <h1 style={styles.title}>Privacy Policy</h1>
        <p style={styles.effective}>
          Effective May 17, 2026. This is a living document — we'll update it as the apps evolve,
          and we'll let you know when we do.
        </p>

        <Section heading="What this is">
          <p style={styles.p}>
            The Human-AI Innovation Commons (HAIIC) is a 501(c)(3) nonprofit. We build free
            AI-powered tools that help inventors — especially those without resources for
            traditional patent counsel — bring their ideas to life. This Privacy Policy explains
            what information we collect when you use the HAIIC apps at apps-haiic.com, why we
            collect it, who we share it with, and what you can do about it.
          </p>
          <p style={styles.p}>
            We've written this in plain English. If anything here is unclear, write to us at{" "}
            <a href="mailto:reachoutto@thehumanaiinnovationcommons.com" style={styles.link}>
              reachoutto@thehumanaiinnovationcommons.com
            </a>
            .
          </p>
        </Section>

        <Section heading="What we collect">
          <p style={styles.p}>When you create an account and use the apps, we collect:</p>
          <ul style={styles.list}>
            <li style={styles.li}>
              <strong style={styles.strong}>Your email address.</strong> Required for sign-in and for occasional
              communication about HAIIC.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Your handle.</strong> What you'd like us to call you across the
              apps. You choose this — we recommend a nickname rather than your real name.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Your background.</strong> The information you enter in your
              profile: work, education, skills, hobbies, passions, lived experience, values, and
              worldview. This is optional but improves the quality of AI conversations.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Your CV, if you choose to upload one.</strong> Used to populate
              your background categories. You can delete the file at any time, and we recommend you
              do once the extraction is complete.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Your project content.</strong> Everything you create in
              Brainstorm, Patent Forge, Per Se, and Figura — conversations with the AI, drafts,
              exports, figures. This belongs to you.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Basic technical information.</strong> Your sign-in sessions and
              timestamps. Standard for any account-based service.
            </li>
          </ul>
          <p style={styles.p}>
            We do not collect your legal name, address, or signature unless you specifically provide
            them at the moment you're preparing a patent for filing. Even then, we do not store that
            information after the document is generated.
          </p>
        </Section>

        <Section heading="Why we collect it">
          <p style={styles.p}>Three reasons:</p>
          <ul style={styles.list}>
            <li style={styles.li}>
              <strong style={styles.strong}>To do the work you're asking us to do.</strong> The apps need to
              know who you are to save your projects, load them on the next visit, and personalize
              the AI's responses so it can draw on what you've shared.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>To improve the apps.</strong> We look at aggregated, anonymized
              patterns of usage — what kinds of inventions people are working on, where they get
              stuck, what they ask the AI most often — to make the tools better.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>To advance HAIIC's mission.</strong> We may share anonymized
              statistics with grant funders, donors, and the board to demonstrate impact ("HAIIC
              supported 200 independent inventors this quarter across 15 industries"). These
              statistics never identify individual users.
            </li>
          </ul>
        </Section>

        <Section heading="Who we share it with">
          <p style={styles.p}>Three service providers help us run the apps:</p>
          <ul style={styles.list}>
            <li style={styles.li}>
              <strong style={styles.strong}>Supabase</strong> stores your account, your profile, and your
              project data. They follow strong security practices and encrypt data at rest.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Vercel</strong> hosts the website itself.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Anthropic</strong> provides the Claude AI model that powers the
              conversations. When you chat with the AI, your messages are sent to Anthropic's API to
              generate responses. Anthropic does not use your messages to train its models, and
              retains them only briefly for trust and safety review.
            </li>
          </ul>
          <p style={styles.p}>
            All three providers store data in the United States.
          </p>
          <p style={styles.p}>
            We do not sell your data. We do not share it with advertisers. We do not share
            identifiable information with funders, the board, or anyone outside HAIIC's small
            operating team. We will never share your data with third parties for their own
            commercial purposes.
          </p>
          <p style={styles.p}>
            If we ever want to share something specific about your work — for example, to feature
            an invention in a case study or grant report — we will ask you first, and you can say
            no.
          </p>
        </Section>

        <Section heading="How long we keep it">
          <p style={styles.p}>
            As long as you have an account, we keep your data so you can return to it. If you
            delete your account, we delete your profile, your projects, and your uploaded files
            within thirty days. Supabase's encrypted backups may retain copies for up to ninety
            days as part of their standard disaster-recovery practice, after which they are
            permanently deleted.
          </p>
          <p style={styles.p}>
            If you delete an individual project, it is removed from the database immediately and
            from backups within ninety days.
          </p>
        </Section>

        <Section heading="How we protect it">
          <ul style={styles.list}>
            <li style={styles.li}>
              All data is encrypted in transit (HTTPS) and at rest (Supabase encryption).
            </li>
            <li style={styles.li}>
              Database access is governed by row-level security policies that ensure you can only
              ever see your own data, enforced at the database level rather than only in application
              code.
            </li>
            <li style={styles.li}>
              Passwords are hashed using bcrypt; we never see or store your password in readable
              form.
            </li>
            <li style={styles.li}>
              Email verification is required to create an account.
            </li>
            <li style={styles.li}>
              Two-factor authentication will be available soon — we'll recommend turning it on when
              it ships.
            </li>
            <li style={styles.li}>
              The Anthropic API key that powers the AI is held server-side only and is never exposed
              in the browser.
            </li>
          </ul>
          <p style={styles.p}>
            We follow standard practice for a small nonprofit. We are not a large company with a
            dedicated security team, and we will be honest with you if we ever discover a problem.
          </p>
        </Section>

        <Section heading="Your rights">
          <p style={styles.p}>You can, at any time:</p>
          <ul style={styles.list}>
            <li style={styles.li}>
              <strong style={styles.strong}>See your data.</strong> Everything you've shared is visible on
              your profile page and inside the apps.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Update or correct it.</strong> Edit your profile, your handle,
              or any project.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Delete it.</strong> Delete individual projects from the
              dashboard, or delete your entire account by writing to us at{" "}
              <a href="mailto:reachoutto@thehumanaiinnovationcommons.com" style={styles.link}>
                reachoutto@thehumanaiinnovationcommons.com
              </a>
              . We honor account deletion requests within seven business days.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Export it.</strong> Every project supports a downloadable .docx
              export. If you want a full account export, write to us and we will prepare one.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>Opt out of communications.</strong> If we send you emails about
              HAIIC's mission or updates, every one will include an unsubscribe link.
            </li>
          </ul>
        </Section>

        <Section heading="A note on AI conversations">
          <p style={styles.p}>
            When you chat with the AI in Brainstorm, Patent Forge, Per Se, or Figura, those
            conversations are saved to your account so you can come back to them. The AI uses your
            profile and the current conversation as context to give better responses. Anthropic
            processes the messages to generate responses but does not train its models on your
            data.
          </p>
          <p style={styles.p}>
            If you would prefer the AI not have access to a particular piece of background, you can
            leave that profile category blank or remove it.
          </p>
        </Section>

        <Section heading="Minimum age">
          <p style={styles.p}>
            HAIIC apps are intended for users 13 and older. If you're under 18, please review this
            policy with a parent or guardian — we want you here and we want them to know what
            you're doing. We do not knowingly collect information from children under 13.
          </p>
        </Section>

        <Section heading="Changes to this policy">
          <p style={styles.p}>
            We may update this policy from time to time. If we make material changes, we'll let you
            know — by email and by a visible notice on the apps — before the changes take effect.
          </p>
        </Section>

        <Section heading="Contact">
          <p style={styles.p}>Questions, concerns, or requests:</p>
          <p style={styles.contact}>
            <a href="mailto:reachoutto@thehumanaiinnovationcommons.com" style={styles.link}>
              reachoutto@thehumanaiinnovationcommons.com
            </a>
          </p>
          <p style={styles.contactSub}>
            The Human-AI Innovation Commons
            <br />
            Decatur, Georgia
            <br />
            501(c)(3) nonprofit
          </p>
        </Section>
      </div>
    </Layout>
  );
}

function Section({ heading, children }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>{heading}</h2>
      {children}
    </div>
  );
}

const styles = {
  wrap:        { maxWidth: 720, margin: "0 auto" },
  label:       { color: theme.red, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 },
  title:       { fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, color: theme.text, marginBottom: 16, lineHeight: 1.2 },
  effective:   { fontSize: 13, color: theme.textDim, fontStyle: "italic", marginBottom: 40, lineHeight: 1.6 },
  section:     { marginBottom: 32 },
  h2:          { fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: theme.text, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${theme.border}` },
  p:           { fontSize: 15, lineHeight: 1.7, color: theme.textMuted, marginBottom: 14 },
  list:        { paddingLeft: 24, marginBottom: 14 },
  li:          { fontSize: 15, lineHeight: 1.7, color: theme.textMuted, marginBottom: 8 },
  strong:      { color: theme.text, fontWeight: 700 },
  link:        { color: theme.red, textDecoration: "underline" },
  contact:     { fontSize: 16, marginBottom: 12 },
  contactSub:  { fontSize: 13, color: theme.textDim, lineHeight: 1.7 },
};
