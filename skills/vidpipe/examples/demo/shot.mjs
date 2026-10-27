// The shot: what the viewer sees, step by step. The same director runs live (record) and filmed (film).
export default {
  url: 'page.html',      // a URL, or a file next to this shot
  cropTop: 64,           // film 720 px starting below the page's 64 px header
  // replay: '/api/',    // requests whose URL contains this are recorded live, then replayed when filming
  async director(D) {
    D.mark('start'); await D.wait(800);
    await D.type('#task', 'buy oat milk'); D.mark('typed'); await D.wait(500);
    await D.tap('button', 'add');
    await D.until(() => D.$('#msg').textContent.includes('Done')); D.mark('first done'); await D.wait(1200);
    await D.type('#task', 'call the plumber'); await D.wait(300);
    await D.tap('button', 'add again');
    await D.until(() => D.$$('li').length === 2); D.mark('second done'); await D.wait(2600);
  },
};
