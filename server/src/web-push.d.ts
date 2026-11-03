declare module 'web-push' {
  interface WebPushModule {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void
    sendNotification(subscription: unknown, payload?: string | Buffer, options?: unknown): Promise<unknown>
    generateVAPIDKeys(): { publicKey: string; privateKey: string }
  }
  const webpush: WebPushModule
  export = webpush
}