const express = require('express');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const path = require('path');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 3000;

// 防重复提交存储
const processedOrders = new Set();

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 添加根路由处理
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 添加通配符路由处理
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 配置邮件发送器
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'lvjiayang0712@gmail.com',
        pass: process.env.GMAIL_PASS || 'yybq sfsg hjbg emty'
    }
});

// Google Sheets API配置
const sheets = google.sheets('v4');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1M-DHqoV5FYCz-B1o2URls3UIBj8XA2dCQkPtNp3_7Y8';
const auth = new google.auth.GoogleAuth({
    credentials: process.env.GOOGLE_SHEETS_CREDENTIALS ? 
        JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS) : 
        require('./credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// 获取产品图片
app.get('/api/product-images', async (req, res) => {
    try {
        const authClient = await auth.getClient();
        const sheetsApi = google.sheets({ version: 'v4', auth: authClient });
        
        const response = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Products!A2:E',
        });
        
        const rows = response.data.values || [];
        const images = rows.map(row => ({
            id: row[0] || '',
            name: row[1] || '',
            price: parseInt(row[2]) || 0,
            imageUrl: row[3] || '',
            description: row[4] || ''
        })).filter(item => item.id && item.name && item.price);
        
        res.json(images);
    } catch (error) {
        console.error('获取产品图片失败:', error);
        res.status(500).json({ error: '获取产品图片失败' });
    }
});

// 获取客户信息
app.get('/api/customer-info', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ error: 'Name parameter is required' });
        }

        const authClient = await auth.getClient();
        const sheetsApi = google.sheets({ version: 'v4', auth: authClient });
        
        const response = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A2:F',
        });
        
        const rows = response.data.values || [];
        const customerInfo = rows.find(row => row[1] === name);
        
        if (customerInfo) {
            res.json({
                name: customerInfo[1],
                address: customerInfo[2],
                phone: customerInfo[3],
                email: customerInfo[4],
                lineId: customerInfo[5]
            });
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error('获取客户信息失败:', error);
        res.status(500).json({ error: '获取客户信息失败' });
    }
});

// 处理订单提交
app.post('/api/submit-order', async (req, res) => {
    try {
        const orderData = req.body;
        
        // 生成订单唯一标识
        const orderKey = `${orderData.email}_${orderData.phone}_${Date.now()}`;
        
        // 检查是否是重复提交
        if (processedOrders.has(orderKey)) {
            console.log('检测到重复提交，已忽略');
            return res.status(200).json({ message: 'Order already processed' });
        }
        
        // 添加到已处理订单集合
        processedOrders.add(orderKey);
        
        // 设置 5 分钟后自动从集合中删除
        setTimeout(() => {
            processedOrders.delete(orderKey);
        }, 5 * 60 * 1000);

        // 生成确认邮件内容
        const mailContent = generateEmailContent(orderData);
        
        try {
            // 发送确认邮件
            await transporter.sendMail({
                from: 'lvjiayang0712@gmail.com',
                to: orderData.email,
                subject: '【フラワーショップTANHUI_Lumos】ご注文確認',
                html: mailContent
            });
            console.log('确认邮件发送成功');
        } catch (emailError) {
            console.error('邮件发送失败:', emailError);
        }
        
        // 保存订单到Google Sheets
        await saveToGoogleSheets(orderData);
        
        res.status(200).json({ 
            success: true,
            message: 'ご注文を承りました。確認メールをご確認ください。'
        });
    } catch (error) {
        console.error('订单处理错误:', error);
        res.status(500).json({ 
            error: 'システムエラーが発生しました。しばらく経ってからもう一度お試しください。',
            details: error.message 
        });
    }
});

// 生成确认邮件内容
function generateEmailContent(orderData) {
    const timeMap = {
        'morning': '午前中',
        'afternoon': '14:00-16:00',
        'evening': '16:00-18:00'
    };
    
    let productsHtml = '';
    if (orderData.products.seasonal800) {
        productsHtml += `
            <tr>
                <td>旬の花 800円</td>
                <td>${orderData.products.seasonal800.quantity}点</td>
                <td>${(orderData.products.seasonal800.quantity * 800).toLocaleString()}円</td>
            </tr>
        `;
    }
    if (orderData.products.seasonal1200) {
        productsHtml += `
            <tr>
                <td>旬の花 1,200円</td>
                <td>${orderData.products.seasonal1200.quantity}点</td>
                <td>${(orderData.products.seasonal1200.quantity * 1200).toLocaleString()}円</td>
            </tr>
        `;
    }
    if (orderData.products.custom) {
        productsHtml += `
            <tr>
                <td>オーダーメイド</td>
                <td>${orderData.products.custom.quantity}点</td>
                <td>${(orderData.products.custom.quantity * orderData.products.custom.price).toLocaleString()}円</td>
            </tr>
        `;
    }

    if (orderData.coupon) {
        productsHtml += `
            <tr>
                <td colspan="2" style="text-align: right;">クーポン割引 (${orderData.coupon.discount * 100}%)</td>
                <td>-${Math.floor(orderData.totalAmount * orderData.coupon.discount).toLocaleString()}円</td>
            </tr>
        `;
    }
    
    return `
        <div style="font-family: 'Hiragino Kaku Gothic Pro', 'メイリオ', sans-serif;">
            <h2>ご注文ありがとうございます。</h2>
            <p>以下の内容でご注文を承りました。</p>
            
            <h3>お客様情報</h3>
            <p>
                お名前: ${orderData.name}<br>
                ご住所: ${orderData.address}<br>
                電話番号: ${orderData.phone}<br>
                メールアドレス: ${orderData.email}<br>
                ${orderData.lineId ? `LINE ID: ${orderData.lineId}<br>` : ''}
            </p>
            
            <h3>ご注文内容</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 0.5rem; border: 1px solid #ddd;">商品</th>
                    <th style="padding: 0.5rem; border: 1px solid #ddd;">数量</th>
                    <th style="padding: 0.5rem; border: 1px solid #ddd;">金額</th>
                </tr>
                ${productsHtml}
                <tr style="background-color: #e9ecef;">
                    <td colspan="2" style="padding: 0.5rem; border: 1px solid #ddd; text-align: right;"><strong>合計</strong></td>
                    <td style="padding: 0.5rem; border: 1px solid #ddd;"><strong>${orderData.totalAmount.toLocaleString()}円</strong></td>
                </tr>
            </table>
            
            <h3>配送希望日時</h3>
            <p>
                第一希望: ${orderData.delivery.first.date} ${timeMap[orderData.delivery.first.time]}<br>
                第二希望: ${orderData.delivery.second.date} ${timeMap[orderData.delivery.second.time]}<br>
                第三希望: ${orderData.delivery.third.date} ${timeMap[orderData.delivery.third.time]}
            </p>
            
            <p style="margin-top: 2rem;">
                ご不明な点がございましたら、お気軽にお問い合わせください。<br>
                今後ともよろしくお願いいたします。
            </p>
        </div>
    `;
}

// 生成配送通知邮件内容
function generateDeliveryNotificationEmail({ customerName, deliveryTime, orderDetails, address }) {
    return `
    <div style="font-family: 'Hiragino Kaku Gothic Pro', 'メイリオ', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">${customerName} 様</h2>
        
        <p>いつもご利用ありがとうございます。</p>
        <p>ご注文いただいたお花の配送時間が確定しましたのでお知らせいたします。</p>
        
        <div style="background-color: #f8f8f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #555; margin-top: 0;">【配送詳細】</h3>
            <p><strong>配送日時：</strong>${deliveryTime}</p>
            <p><strong>配送先住所：</strong>${address}</p>
            <p><strong>ご注文内容：</strong>${orderDetails}</p>
        </div>
        
        <p>配送時間になりましたら、スタッフよりご連絡させていただきます。</p>
        <p>何かご不明な点がございましたら、お気軽にお問い合わせください。</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
                ※このメールは自動送信されています。<br>
                ※本メールに心当たりのない場合は、お手数ですが破棄していただきますようお願いいたします。
            </p>
        </div>
    </div>
    `;
}

// 保存订单到Google Sheets
async function saveToGoogleSheets(orderData) {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            const authClient = await auth.getClient();
            const sheetsApi = google.sheets({ version: 'v4', auth: authClient });
            
            const values = [
                [
                    new Date().toISOString(),                    // 订单时间
                    orderData.name,                              // 顾客姓名
                    orderData.address,                           // 地址
                    orderData.phone,                             // 电话
                    orderData.email,                             // 邮箱
                    orderData.lineId || '',                      // LINE ID
                    JSON.stringify(orderData.products),          // 商品详情
                    orderData.totalAmount,                       // 总金额
                    JSON.stringify(orderData.delivery),          // 配送信息
                    orderData.coupon ? JSON.stringify(orderData.coupon) : '', // 优惠券信息
                    '',                                          // 配送时间（预留）
                    ''                                           // 通知状态（预留）
                ]
            ];

            const response = await sheetsApi.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Orders!A:L',
                valueInputOption: 'RAW',
                resource: { values }
            });

            console.log('✅ 订单数据已成功保存到 Google Sheets');
            return response;
        } catch (error) {
            attempt++;
            console.error(`❌ 保存订单数据失败 (尝试 ${attempt}/${maxRetries}):`, error);
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// 添加自动检查配送通知的任务
cron.schedule('*/5 * * * *', async () => {
    try {
        console.log('🔍 开始检查需要发送的配送通知...');
        
        const authClient = await auth.getClient();
        const sheetsApi = google.sheets({ version: 'v4', auth: authClient });
        
        const response = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Orders!A2:L',
        });
        
        const rows = response.data.values || [];
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 2;
            
            if (row.length >= 10) {
                const orderDate = row[0];
                const customerName = row[1];
                const address = row[2];
                const customerEmail = row[4];
                const orderDetails = row[6];
                const deliveryInfo = row[8];
                const confirmedDeliveryTime = row[10];  // K列：确认的配送时间
                const notificationStatus = row[11];     // L列：通知状态
                
                // 检查是否需要发送通知（有确认的配送时间且未发送过通知）
                if (customerEmail && confirmedDeliveryTime && !notificationStatus) {
                    try {
                        await transporter.sendMail({
                            from: 'lvjiayang0712@gmail.com',
                            to: customerEmail,
                            subject: '【お花の配送時間のお知らせ】',
                            html: generateDeliveryNotificationEmail({
                                customerName,
                                deliveryTime: confirmedDeliveryTime,
                                orderDetails,
                                address
                            })
                        });
                        
                        // 更新通知状态
                        await sheetsApi.spreadsheets.values.update({
                            spreadsheetId: SPREADSHEET_ID,
                            range: `Orders!L${rowNumber}`,
                            valueInputOption: 'RAW',
                            resource: {
                                values: [['已发送']]
                            }
                        });

                        console.log(`✅ 配送通知邮件已发送给：${customerEmail}`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                    } catch (error) {
                        console.error(`❌ 发送邮件到 ${customerEmail} 失败:`, error.message);
                    }
                }
            }
        }
        
        console.log('✨ 配送通知检查完成');
        
    } catch (error) {
        console.error('❌ 自动发送配送通知时发生错误:', error.message);
    }
});

// 添加通配符路由处理所有其他请求
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
app.listen(port, () => {
    console.log('=================================');
    console.log('🌸 フラワーショップサーバー起動中');
    console.log(`🌐 サーバーアドレス: http://localhost:${port}`);
    console.log('=================================');
});