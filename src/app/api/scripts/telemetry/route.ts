// NUMI build: Umami's telemetry script loads a pixel from i.umami.is, so it is always off here.
export async function GET() {
  return new Response('/* telemetry disabled */', {
    headers: {
      'content-type': 'text/javascript',
    },
  });
}
