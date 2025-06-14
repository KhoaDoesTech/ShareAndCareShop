const documents = [
  // Chính sách 1
  {
    pageContent:
      '🧾 Chính sách đổi trả: Quý khách có thể đổi hoặc trả hàng trong vòng 7 ngày kể từ ngày nhận hàng. Sản phẩm phải còn nguyên tem, nhãn, chưa qua sử dụng.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/policy/return',
      type: 'policy',
      policyType: 'return',
    },
  },

  // Chính sách 2
  {
    pageContent:
      '🚚 Giao hàng toàn quốc: Chúng tôi hỗ trợ giao hàng toàn quốc với thời gian từ 1 đến 5 ngày làm việc, tùy khu vực.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/shipping',
      type: 'policy',
      policyType: 'shipping',
    },
  },

  // Chính sách 3
  {
    pageContent:
      '💳 Phương thức thanh toán: Hỗ trợ thanh toán bằng tiền mặt khi nhận hàng (COD), chuyển khoản ngân hàng, hoặc ví điện tử (Momo, ZaloPay, VNPay).',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/payment',
      type: 'policy',
      policyType: 'payment',
    },
  },

  // Chính sách 4
  {
    pageContent:
      '📦 Theo dõi đơn hàng: Sau khi đặt hàng thành công, quý khách sẽ nhận được mã vận đơn để theo dõi trạng thái giao hàng trực tuyến.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/track-order',
      type: 'policy',
      policyType: 'order-tracking',
    },
  },

  // Chính sách 5
  {
    pageContent:
      '📞 Hỗ trợ khách hàng: Đội ngũ chăm sóc khách hàng hoạt động từ 8h – 21h mỗi ngày. Liên hệ qua hotline 1900 1234 hoặc Zalo.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/support',
      type: 'policy',
      policyType: 'customer-support',
    },
  },

  // Chính sách 6
  {
    pageContent:
      '🔒 Chính sách bảo mật: Thông tin cá nhân của khách hàng được bảo mật tuyệt đối, không chia sẻ cho bên thứ ba nếu không có sự đồng ý.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/privacy',
      type: 'policy',
      policyType: 'privacy',
    },
  },

  // Chính sách 7
  {
    pageContent:
      '🎫 Chính sách hoàn tiền: Hoàn tiền 100% nếu sản phẩm lỗi do nhà sản xuất hoặc giao nhầm hàng. Thời gian xử lý hoàn tiền là 3–5 ngày làm việc.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/refund',
      type: 'policy',
      policyType: 'refund',
    },
  },
];

module.exports = documents;
