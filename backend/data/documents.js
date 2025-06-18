const documents = [
  {
    pageContent:
      'Chính sách đổi/trả hàng: Quý khách được quyền đổi hoặc trả sản phẩm trong vòng 7 ngày kể từ ngày nhận hàng. Điều kiện: sản phẩm còn nguyên tem, nhãn mác, chưa qua sử dụng. Để tiến hành đổi/trả, vui lòng gửi yêu cầu tại mục Quản lý đơn hàng hoặc liên hệ hotline 0812056724 / email: shareandcaret@gmail.com. Vui lòng cung cấp mã đơn hàng và lý do đổi/trả khi liên hệ.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/profile',
      type: 'policy',
      policyType: 'return',
    },
  },
  {
    pageContent:
      'Giao hàng nội thành TP. Hồ Chí Minh: Chúng tôi hỗ trợ giao hàng trong khu vực nội thành TP.HCM với thời gian từ 1 đến 5 ngày làm việc, tùy thuộc vào khu vực cụ thể. Lưu ý: không hỗ trợ giao hàng trong vòng 1 tiếng.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app',
      type: 'policy',
      policyType: 'shipping',
    },
  },
  {
    pageContent:
      'Phương thức thanh toán: Chúng tôi hỗ trợ các hình thức thanh toán sau: 1) Thanh toán tiền mặt khi nhận hàng (COD), 2) Chuyển khoản ngân hàng, 3) Ví điện tử bao gồm Momo, ZaloPay và VNPay.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app',
      type: 'policy',
      policyType: 'payment',
    },
  },
  {
    pageContent:
      'Theo dõi đơn hàng: Sau khi đặt hàng thành công, quý khách có thể theo dõi trạng thái giao hàng trực tuyến thông qua hệ thống của chúng tôi.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/profile',
      type: 'policy',
      policyType: 'order-tracking',
    },
  },
  {
    pageContent:
      ' Hỗ trợ khách hàng: Đội ngũ chăm sóc khách hàng hoạt động từ 8h đến 21h mỗi ngày. Quý khách có thể liên hệ qua chat trên website https://share-and-care-client.vercel.app, hotline 0812056724, email shareandcaret@gmail.com, hoặc Zalo. Nếu cần gặp nhân viên tư vấn trực tiếp, vui lòng gửi yêu cầu qua kênh chat.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app',
      type: 'policy',
      policyType: 'customer-support',
    },
  },
  {
    pageContent:
      'Chính sách bảo mật: Thông tin cá nhân của khách hàng được bảo mật tuyệt đối, không chia sẻ cho bên thứ ba nếu không có sự đồng ý. Dữ liệu được lưu trữ an toàn trên hệ thống mã hóa.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app',
      type: 'policy',
      policyType: 'privacy',
    },
  },
  {
    pageContent:
      'Chính sách hoàn tiền: Chúng tôi hỗ trợ hoàn tiền 100% với bất kỳ lý do nào, với điều kiện sản phẩm còn nguyên vẹn. Thời gian xử lý hoàn tiền là từ 3 đến 5 ngày làm việc. Quý khách có thể liên hệ qua hotline 0812056724, truy cập website https://share-and-care-client.vercel.app hoặc gửi yêu cầu hoàn trả tại mục Quản lý đơn hàng để được hỗ trợ.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/profile',
      type: 'policy',
      policyType: 'refund',
    },
  },
  {
    pageContent:
      'Giới thiệu website Share & Care: Share & Care là nền tảng mua sắm trực tuyến cung cấp các sản phẩm thời trang nam, nữ, phụ kiện, và giày dép.  Các danh mục chính bao gồm: thời trang nam, thời trang nữ, đồ thể thao, phụ kiện. Xem sản phẩm mới nhất tại https://share-and-care-client.vercel.app/shop?sort=-CREATED_AT, sản phẩm bán chạy tại https://share-and-care-client.vercel.app/shop?sort=-SOLD .',
    metadata: {
      source: 'https://share-and-care-client.vercel.app',
      type: 'website-info',
      infoType: 'introduction',
    },
  },
  {
    pageContent:
      'Cửa hàng: Trang cửa hàng tại https://share-and-care-client.vercel.app/shop hiển thị tất cả sản phẩm thời trang nam, nữ, giày dép, và phụ kiện. Quý khách có thể lọc sản phẩm theo danh mục, giá, hoặc kích cỡ.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/shop',
      type: 'website-info',
      infoType: 'shop',
    },
  },

  {
    pageContent:
      'Sản phẩm mới nhất: Xem các sản phẩm mới ra mắt tại https://share-and-care-client.vercel.app/shop?sort=-CREATED_AT, bao gồm áo sơ mi nam, váy midi nữ, và giày thể thao hot trend.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/shop?sort=-CREATED_AT',
      type: 'website-info',
      infoType: 'latest-products',
    },
  },
  {
    pageContent:
      'Giỏ hàng: Quý khách có thể xem và chỉnh sửa giỏ hàng tại https://share-and-care-client.vercel.app/cart. Để đặt hàng, thêm sản phẩm vào giỏ hàng, chọn kích cỡ và số lượng, sau đó tiến hành thanh toán.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/cart',
      type: 'website-info',
      infoType: 'cart',
    },
  },
  {
    pageContent:
      'Đặt hàng: Để đặt hàng, truy cập https://share-and-care-client.vercel.app/order, chọn sản phẩm, điền thông tin giao hàng và thanh toán. ',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/order',
      type: 'support',
      supportType: 'order-placement',
    },
  },
  {
    pageContent:
      'Đăng nhập: Đăng nhập tài khoản tại https://share-and-care-client.vercel.app/auth/login để quản lý đơn hàng và thông tin cá nhân. Nếu quên mật khẩu, truy cập https://share-and-care-client.vercel.app/auth/forgot-password.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/auth/login',
      type: 'support',
      supportType: 'login',
    },
  },
  {
    pageContent:
      'Đăng ký: Tạo tài khoản mới tại https://share-and-care-client.vercel.app/auth/sign-up để nhận ưu đãi dành cho thành viên và theo dõi đơn hàng dễ dàng.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/auth/sign-up',
      type: 'support',
      supportType: 'sign-up',
    },
  },
  {
    pageContent:
      'Quên mật khẩu: Để lấy lại mật khẩu, truy cập https://share-and-care-client.vercel.app/auth/forgot-password, nhập email đã đăng ký và làm theo hướng dẫn.',
    metadata: {
      source: 'https://share-and-care-client.vercel.app/auth/forgot-password',
      type: 'support',
      supportType: 'forgot-password',
    },
  },
];

module.exports = documents;
