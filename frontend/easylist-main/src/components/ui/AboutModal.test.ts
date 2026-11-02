import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = fileURLToPath(new URL('.', import.meta.url));

test('AboutModal fulfills Section 6 requirements strictly', () => {
  const modalFilePath = resolve(currentDir, 'AboutModal.tsx');
  const content = readFileSync(modalFilePath, 'utf-8');

  // Title: About EasyList
  assert.ok(content.includes('About EasyList'), 'Must contain title "About EasyList"');

  // Description for EasyList
  assert.ok(
    content.includes(
      'EasyList simplifies wholesale order management by converting handwritten Tamil and English orders into organized digital product lists. Upload an order image, extract product details, edit the results, and export them in seconds.'
    ),
    'Must include the exact EasyList description'
  );

  // Title: Built by Avenzo Technologies
  assert.ok(
    content.includes('Built by Avenzo Technologies'),
    'Must contain title "Built by Avenzo Technologies"'
  );

  // Description for Avenzo Technologies
  assert.ok(
    content.includes(
      'Avenzo Technologies builds practical digital products that simplify everyday business operations.'
    ),
    'Must include the exact Avenzo Technologies description'
  );

  // Website link opening in new tab
  assert.ok(
    content.includes('https://avenzo-technologies.web.app'),
    'Must include official website link'
  );
  assert.ok(
    content.includes('target="_blank"'),
    'Website link must open in a new tab'
  );

  // Email selectable text with copy button, NO mailto
  assert.ok(
    content.includes('avenzotechnologies05@gmail.com'),
    'Must display official email address'
  );
  assert.ok(
    !content.includes('mailto:'),
    'Must NOT contain mailto: link (no automatic email client launch)'
  );
  assert.ok(
    content.includes('navigator.clipboard.writeText'),
    'Must provide copy-to-clipboard functionality'
  );

  // Close behavior
  assert.ok(content.includes('Escape'), 'Must support closing on Escape key');
  assert.ok(
    content.includes("overflow = 'hidden'"),
    'Must prevent background scrolling while open'
  );
  assert.ok(
    content.includes('#111C35'),
    'Must use navy #111C35 color for headings'
  );
  assert.ok(
    content.includes('#5046F2'),
    'Must use violet #5046F2 accents'
  );

  // Prohibited elements
  assert.ok(
    !content.includes('leadership'),
    'Must not include leadership team section'
  );
  assert.ok(
    !content.includes('founders'),
    'Must not include founders section'
  );
});

test('DashboardHeader wires About button to open AboutModal as popup without route navigation', () => {
  const headerPath = resolve(currentDir, '../layout/DashboardHeader.tsx');
  const content = readFileSync(headerPath, 'utf-8');

  assert.ok(
    content.includes('import { AboutModal } from \'../ui/AboutModal\';'),
    'DashboardHeader must import AboutModal'
  );
  assert.ok(
    content.includes('isAboutModalOpen'),
    'DashboardHeader must maintain isAboutModalOpen state'
  );
  assert.ok(
    content.includes('id="btn-header-about"'),
    'DashboardHeader must contain btn-header-about button'
  );
  assert.ok(
    !content.includes('navigate(ROUTES.ABOUT)'),
    'DashboardHeader must not navigate to ROUTES.ABOUT on clicking about button'
  );
  assert.ok(
    content.includes('<AboutModal'),
    'DashboardHeader must render AboutModal component'
  );
});
