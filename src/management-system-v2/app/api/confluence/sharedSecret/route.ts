import { NextRequest, NextResponse } from 'next/server';

let sharedSecrets: { [key: string]: { sharedSecret: any; baseUrl: any } } = {}; // Variable zum Speichern der sharedSecrets

const setSharedSecret = (clientKey: any, sharedSecret: any, baseUrl: any) => {
  sharedSecrets[`${clientKey}`] = { sharedSecret, baseUrl };
};

const getSharedSecret = (clientKey: string) => {
  return sharedSecrets[clientKey];
};

const getAllSharedSecrets = () => {
  return { ...sharedSecrets };
};

export async function GET(request: NextRequest) {
  return NextResponse.json({ sharedSecrets });
}

export async function PUT(request: NextRequest) {
  const bodyData = await request.json();
  const { clientKey, sharedSecret, baseUrl } = bodyData;

  setSharedSecret(clientKey, sharedSecret, baseUrl);

  return NextResponse.json({ clientKey, sharedSecret, baseUrl });
}
