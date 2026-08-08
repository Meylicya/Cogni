import React from 'react';

export default function EvidencePage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Work Sans, sans-serif', color: '#1E3A4C' }}>
      <h2 style={{ color: '#1E3A4C', fontFamily: 'Newsreader, serif', borderBottom: '2px solid #5B8A9A', paddingBottom: '0.5rem' }}>
        Evidence & Guidelines
      </h2>
      
      <section style={{ backgroundColor: '#F2F5F7', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', borderLeft: '4px solid #D98E5B' }}>
        <h3 style={{ marginTop: 0, fontFamily: 'Newsreader, serif' }}>Clinical Positioning & Safety</h3>
        <p style={{ lineHeight: '1.6' }}>
          This application is an active, adaptive cognitive rehabilitation tool designed explicitly for the <strong>sub-acute and persistent-symptom phases</strong> of concussion recovery under clinician supervision. It is strictly <strong>not a diagnostic tool</strong>, nor is it intended for acute injury management (first 0–48 hours). In accordance with responsible medical software design, we honestly represent that evidence for the transfer of cognitive training beyond the directly trained tasks remains limited. This tool is intended to complement, not replace, comprehensive professional care.
        </p>
      </section>

      <section>
        <h3 style={{ fontFamily: 'Newsreader, serif', color: '#5B8A9A' }}>Verified Research Citations</h3>
        <ul style={{ lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Originally Verified Citations */}
          <li>
            <strong>Bayley, M. T., et al. (2023).</strong> INCOG 2.0 Guidelines for Cognitive Rehabilitation Following Traumatic Brain Injury: Methods, Overview, and Principles. <em>Journal of Head Trauma Rehabilitation</em>, 38(1), 7–23.
          </li>
          <li>
            <strong>Velikonja, D., et al. (2023).</strong> INCOG 2.0 Guidelines for Cognitive Rehabilitation Following Traumatic Brain Injury, Part V: Memory. <em>Journal of Head Trauma Rehabilitation</em>, 38(1), 83–102.
          </li>
          <li>
            <strong>Patricios, J. S., et al. (2023).</strong> Consensus statement on concussion in sport: the 6th International Conference on Concussion in Sport–Amsterdam, October 2022. <em>British Journal of Sports Medicine</em>, 57(11), 695–711.
          </li>
          <li>
            <strong>Soveri, A., Antfolk, J., Karlsson, L., Salo, B., & Laine, M. (2017).</strong> Working memory training revisited: A multi-level meta-analysis of n-back training studies. <em>Psychonomic Bulletin & Review</em>, 24(4), 1077–1096.
          </li>
          <li>
            <strong>Norman, R. S., Shah, M. N., & Turkstra, L. S. (2019).</strong> Language Comprehension After Mild Traumatic Brain Injury: The Role of Speed. <em>American Journal of Speech-Language Pathology</em>, 28(4), 1479–1490.
          </li>
          <li>
            <strong>Cicerone, K. D., et al. (2011) & Bayley et al. (2014)</strong> — Active rehabilitation (not cognitive rest) as standard of care for non-sports-concussion TBI.
          </li>
          
          {/* Newly Verified Citations */}
          <li>
            <strong>Blacker, K. J., Negoita, S., Ewen, J. B., & Courtney, S. M. (2017).</strong> N-back versus complex span working memory training. <em>Journal of Cognitive Enhancement</em>, 1(4), 434–454.
          </li>
          <li>
            <strong>Bogdanova, Y., Yee, M. K., Ho, V. T., & Cicerone, K. D. (2016).</strong> Computerized Cognitive Rehabilitation of Attention and Executive Function in Acquired Brain Injury: A Systematic Review. <em>Journal of Head Trauma Rehabilitation</em>, 31(6), 419–433.
          </li>
          <li>
            <strong>Hocke, L. M., Duszynski, C. C., Debert, C. T., Dleikan, D., & Dunn, J. F. (2018).</strong> Reduced Functional Connectivity in Adults with Persistent Post-Concussion Symptoms: A Functional Near-Infrared Spectroscopy Study. <em>Journal of Neurotrauma</em>, 35(11), 1224–1232.
          </li>
          <li>
            <strong>Kontos, A. P., et al. (2014).</strong> Brain activation during neurocognitive testing using functional near-infrared spectroscopy in patients following concussion compared to healthy controls. <em>Brain Imaging and Behavior</em>, 8(4), 621–634.
          </li>
          <li>
            <strong>Lee, H. Y., Hyun, S. E., & Oh, B.-M. (2023).</strong> Rehabilitation for Impaired Attention in the Acute and Post-Acute Phase After Traumatic Brain Injury: A Narrative Review. <em>Korean Journal of Neurotrauma</em>, 19(1), 20–32.
          </li>
          <li>
            <strong>de Freitas Cardoso, M. G., et al. (2019).</strong> Cognitive Impairment Following Acute Mild Traumatic Brain Injury. <em>Frontiers in Neurology</em>, 10.
          </li>
          <li>
            <strong>Ilie, G., Cusimano, M. D., & Li, W. (2017).</strong> Prosodic processing post traumatic brain injury – a systematic review. <em>Systematic Reviews</em>, 6.
          </li>
          <li>
            <strong>Norman, R. S., Flaugher, T., Chang, S., & Power, E. (2023).</strong> Self-Perception of Cognitive-Communication Functions After Mild Traumatic Brain Injury. <em>American Journal of Speech-Language Pathology</em>, 32(2), 883–906.
          </li>
          <li>
            <strong>Norman, R. S., Mueller, K. D., Huerta, P., et al. (2022).</strong> Discourse Performance in Adults With Mild Traumatic Brain Injury, Orthopedic Injuries, and Moderate to Severe Traumatic Brain Injury, and Healthy Controls. <em>American Journal of Speech-Language Pathology</em>, 31(1), 67–83.
          </li>
          <li>
            <strong>Patel, S., Grabowski, C., Dayalu, V., & Testa, A. J. (2023).</strong> Speech error rates after a sports-related concussion. <em>Frontiers in Psychology</em>, 14.
          </li>
          <li>
            <strong>Cottingham, M. E., & Boone, K. B. (2010).</strong> Non-credible language deficits following mild traumatic brain injury. <em>The Clinical Neuropsychologist</em>, 24(6), 1006–1025.
          </li>
        </ul>
      </section>
    </div>
  );
}