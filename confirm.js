document.addEventListener('DOMContentLoaded', function() {
    // 从 sessionStorage 获取订单数据
    const orderData = JSON.parse(sessionStorage.getItem('orderData'));
    if (!orderData) {
        window.location.href = 'index.html';
        return;
    }

    // 填充客户信息
    document.getElementById('customerName').textContent = orderData.name;
    document.getElementById('customerAddress').textContent = orderData.address;
    document.getElementById('customerPhone').textContent = orderData.phone;
    document.getElementById('customerEmail').textContent = orderData.email;
    
    // 处理 LINE ID
    if (orderData.lineId) {
        document.getElementById('lineIdRow').style.display = 'table-row';
        document.getElementById('customerLine').textContent = orderData.lineId;
    }

    // 填充商品信息
    const orderDetails = document.getElementById('orderDetails');
    let productsHtml = '';
    let subtotal = 0;
    
    if (orderData.products.seasonal800 && orderData.products.seasonal800.quantity > 0) {
        const amount = orderData.products.seasonal800.quantity * 800;
        subtotal += amount;
        productsHtml += `
            <tr>
                <td>旬の花 800円</td>
                <td>${orderData.products.seasonal800.quantity}点</td>
                <td>${amount.toLocaleString()}円</td>
            </tr>
        `;
    }
    
    if (orderData.products.seasonal1200 && orderData.products.seasonal1200.quantity > 0) {
        const amount = orderData.products.seasonal1200.quantity * 1200;
        subtotal += amount;
        productsHtml += `
            <tr>
                <td>旬の花 1,200円</td>
                <td>${orderData.products.seasonal1200.quantity}点</td>
                <td>${amount.toLocaleString()}円</td>
            </tr>
        `;
    }
    
    if (orderData.products.custom && orderData.products.custom.quantity > 0) {
        const amount = orderData.products.custom.quantity * orderData.products.custom.price;
        subtotal += amount;
        productsHtml += `
            <tr>
                <td>オーダーメイド</td>
                <td>${orderData.products.custom.quantity}点</td>
                <td>${amount.toLocaleString()}円</td>
            </tr>
        `;
    }

    // 添加优惠券信息（如果有）
    if (orderData.coupon) {
        const discount = Math.floor(subtotal * orderData.coupon.discount);
        productsHtml += `
            <tr>
                <td colspan="2" style="text-align: right;">クーポン割引 (${orderData.coupon.discount * 100}%)</td>
                <td>-${discount.toLocaleString()}円</td>
            </tr>
        `;
    }

    // 添加合计金额
    productsHtml += `
        <tr class="total-row">
            <td colspan="2" style="text-align: right;"><strong>合計</strong></td>
            <td><strong>${orderData.totalAmount.toLocaleString()}円</strong></td>
        </tr>
    `;
    
    orderDetails.innerHTML = productsHtml;

    // 填充配送信息
    const timeMap = {
        'morning': '午前中',
        'afternoon': '14:00-16:00',
        'evening': '16:00-18:00'
    };

    document.getElementById('deliveryFirst').textContent = 
        `${orderData.delivery.first.date} ${timeMap[orderData.delivery.first.time]}`;
    document.getElementById('deliverySecond').textContent = 
        `${orderData.delivery.second.date} ${timeMap[orderData.delivery.second.time]}`;
    document.getElementById('deliveryThird').textContent = 
        `${orderData.delivery.third.date} ${timeMap[orderData.delivery.third.time]}`;

    // 处理确认按钮点击
    document.getElementById('confirmButton').addEventListener('click', async function() {
        try {
            const response = await fetch('/api/submit-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
            });

            if (response.ok) {
                // 隐藏确认表单
                document.getElementById('confirmationSection').style.display = 'none';
                // 显示感谢信息
                document.getElementById('thankYouSection').style.display = 'block';
                // 清除 sessionStorage
                sessionStorage.removeItem('orderData');
            } else {
                throw new Error('注文の処理中にエラーが発生しました。');
            }
        } catch (error) {
            alert('エラーが発生しました。もう一度お試しください。\n' + error.message);
        }
    });

    // 处理返回按钮点击
    document.getElementById('backButton').addEventListener('click', function() {
        window.history.back();
    });
});