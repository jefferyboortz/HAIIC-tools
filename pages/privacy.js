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
