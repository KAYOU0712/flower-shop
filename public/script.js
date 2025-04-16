document.addEventListener('DOMContentLoaded', function() {
    // 设置日期选择器的最小日期为明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.min = tomorrow.toISOString().split('T')[0];
    });

    // 计算总金额
    function calculateTotal() {
        let total = 0;
        
        // 计算800日元商品
        const seasonal800Quantity = parseInt(document.getElementById('seasonal800Quantity')?.value || 0);
        total += seasonal800Quantity * 800;

        // 计算1200日元商品
        const seasonal1200Quantity = parseInt(document.getElementById('seasonal1200Quantity')?.value || 0);
        total += seasonal1200Quantity * 1200;

        // 计算定制商品
        const customQuantity = parseInt(document.getElementById('customQuantity')?.value || 0);
        const customPrice = parseInt(document.getElementById('customPrice')?.value || 0);
        total += customQuantity * customPrice;

        // 应用优惠券折扣
        if (window.currentCoupon) {
            total = Math.floor(total * (1 - window.currentCoupon.discount));
        }

        const totalElement = document.getElementById('totalAmount');
        if (totalElement) {
            totalElement.textContent = total.toLocaleString();
        }
        return total;
    }

    // 监听数量和价格变化
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('change', calculateTotal);
        input.addEventListener('input', calculateTotal);
    });

    // 优惠券处理
    const applyCouponButton = document.getElementById('applyCoupon');
    if (applyCouponButton) {
        applyCouponButton.addEventListener('click', function() {
            const code = document.getElementById('couponCode')?.value.trim().toUpperCase() || '';
            const coupons = {
                'FIRSTBUY2025': { discount: 0.20, message: '20%割引を適用しました' },
                'LINESHARE2025': { discount: 0.10, message: '10%割引を適用しました' }
            };

            const coupon = coupons[code];
            const couponMessage = document.getElementById('couponMessage');
            if (coupon && couponMessage) {
                window.currentCoupon = coupon;
                couponMessage.textContent = coupon.message;
                couponMessage.style.color = '#2ecc71';
                calculateTotal();
            } else if (couponMessage) {
                couponMessage.textContent = '無効なクーポンコードです';
                couponMessage.style.color = '#e74c3c';
                window.currentCoupon = null;
                calculateTotal();
            }
        });
    }

    // 表单提交处理
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // 验证至少选择了一个商品
            const seasonal800Quantity = parseInt(document.getElementById('seasonal800Quantity')?.value || 0);
            const seasonal1200Quantity = parseInt(document.getElementById('seasonal1200Quantity')?.value || 0);
            const customQuantity = parseInt(document.getElementById('customQuantity')?.value || 0);

            if (seasonal800Quantity + seasonal1200Quantity + customQuantity === 0) {
                alert('商品を1つ以上選択してください。');
                return;
            }

            // 收集订单数据
            const orderData = {
                products: {
                    seasonal800: {
                        size: document.getElementById('seasonal800Size')?.value,
                        quantity: seasonal800Quantity
                    },
                    seasonal1200: {
                        size: document.getElementById('seasonal1200Size')?.value,
                        quantity: seasonal1200Quantity
                    },
                    custom: {
                        size: document.getElementById('customSize')?.value,
                        quantity: customQuantity,
                        price: parseInt(document.getElementById('customPrice')?.value || 0)
                    }
                },
                coupon: window.currentCoupon,
                totalAmount: calculateTotal(),
                name: document.getElementById('name')?.value,
                address: document.getElementById('address')?.value,
                phone: document.getElementById('phone')?.value,
                email: document.getElementById('email')?.value,
                lineId: document.getElementById('lineId')?.value,
                delivery: {
                    first: {
                        date: document.getElementById('firstDate')?.value,
                        time: document.getElementById('firstTime')?.value
                    },
                    second: {
                        date: document.getElementById('secondDate')?.value,
                        time: document.getElementById('secondTime')?.value
                    },
                    third: {
                        date: document.getElementById('thirdDate')?.value,
                        time: document.getElementById('thirdTime')?.value
                    }
                }
            };

            // 保存订单数据到sessionStorage
            sessionStorage.setItem('orderData', JSON.stringify(orderData));

            // 跳转到确认页面
            window.location.href = '/confirm.html';
        });
    }

    // 初始化计算总金额
    calculateTotal();
});