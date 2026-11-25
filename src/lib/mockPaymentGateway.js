
/**
 * Build 4: Mock payment gateway.
 *
 * This simulates payment approval or decline.
 * It never receives or stores a card number.
 */

export function createMockPaymentGateway() {
  return {
    async charge({ outcome = 'approved' } = {}) {
      // Simulate an asynchronous payment request.
      await new Promise((resolve) => setTimeout(resolve, 10));

      if (outcome === 'declined') {
        return {
          success: false,
          code: 'PAYMENT_DECLINED',
          message: 'The mock payment was declined',
        };
      }

      if (outcome !== 'approved') {
        throw new TypeError('Payment outcome must be approved or declined');
      }

      return {
        success: true,
        transactionId: `MOCK-${Date.now()}`,
      };
    },
  };
}
