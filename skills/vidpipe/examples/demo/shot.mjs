// The shot: what the viewer sees, step by step. The same director runs live (record) and filmed (film).
// Explain, then act: each caption (say*) shows while the page is still, and ends at the next action (do*).
export default {
  url: 'page.html',      // a URL, or a file next to this shot
  cropTop: 64,           // film 720 px starting below the page's 64 px header
  // replay: '/api/',    // requests whose URL contains this are recorded live, then replayed when filming
  async director(D) {
    D.mark('say1'); await D.wait(3600);
    D.mark('do1'); await D.type('#task', 'buy oat milk'); await D.wait(400);
    await D.tap('button', 'add');
    await D.until(() => D.$('#msg').textContent.includes('Done')); await D.wait(500);
    D.mark('say2'); await D.wait(3600);
    D.mark('do2'); await D.type('#task', 'call the plumber'); await D.wait(300);
    await D.tap('button', 'add again');
    await D.until(() => D.$$('li').length === 2); await D.wait(500);
    D.mark('say3'); await D.wait(3500);
  },
};
