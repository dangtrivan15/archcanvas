import type { NodeDef } from '../../../../types/nodeDefSchema';

export const notificationDef: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'notification',
    namespace: 'messaging',
    version: '1.0.0',
    displayName: 'Notification',
    description:
      'Multi-channel notification service for delivering alerts via email, SMS, push, or webhook.',
    icon: 'Bell',
    tags: ['alerts', 'notifications', 'push'],
    shape: 'arrow-right',
  },
  spec: {
    args: [
      {
        name: 'channels',
        type: 'enum',
        options: ['email', 'sms', 'push', 'webhook'],
        description: 'Delivery channel for notifications.',
      },
      {
        name: 'provider',
        type: 'string',
        description:
          'Third-party provider or service used for delivery (e.g., SendGrid, Twilio, Firebase).',
      },
    ],
    ports: [
      {
        name: 'notify-in',
        direction: 'inbound',
        protocol: ['Event', 'HTTP'],
        description:
          'Inbound port for receiving notification trigger events.',
      },
      {
        name: 'delivery-out',
        direction: 'outbound',
        protocol: ['SMTP', 'HTTP', 'Push'],
        description:
          'Outbound port for dispatching notifications to end recipients.',
      },
    ],
    ai: {
      context:
        'A notification node routes alert and notification events to users or systems through one or more delivery channels. Consider rate limiting, template management, and delivery confirmation when reviewing the notification flow.',
      reviewHints: [
        'Check that rate limiting is configured to prevent notification flooding.',
        'Verify fallback or retry logic for failed delivery attempts across channels.',
        'Ensure sensitive data in notification payloads is properly masked or encrypted.',
      ],
    },
  },
};
