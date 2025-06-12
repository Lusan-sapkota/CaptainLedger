import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import tempfile
from flask import current_app

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.email = os.getenv('EMAIL_ADDRESS')
        self.password = os.getenv('EMAIL_PASSWORD')
        
    def create_transaction_pdf(self, transactions, period_name, user_name):
        """Create a PDF report of transactions"""
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        
        # Create PDF document
        doc = SimpleDocTemplate(temp_file.name, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#2E86AB')
        )
        story.append(Paragraph(f"CaptainLedger - {period_name} Report", title_style))
        story.append(Spacer(1, 12))
        
        # User info
        story.append(Paragraph(f"<b>User:</b> {user_name}", styles['Normal']))
        story.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Summary
        total_income = sum(t['amount'] for t in transactions if t['amount'] > 0)
        total_expenses = sum(abs(t['amount']) for t in transactions if t['amount'] < 0)
        net_savings = total_income - total_expenses
        
        summary_data = [
            ['Summary', ''],
            ['Total Income', f"${total_income:.2f}"],
            ['Total Expenses', f"${total_expenses:.2f}"],
            ['Net Savings', f"${net_savings:.2f}"],
            ['Transaction Count', str(len(transactions))]
        ]
        
        summary_table = Table(summary_data, colWidths=[2*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2E86AB')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 30))
        
        # Transactions table
        if transactions:
            story.append(Paragraph("Transaction Details", styles['Heading2']))
            story.append(Spacer(1, 12))
            
            # Sort transactions by date
            sorted_transactions = sorted(transactions, key=lambda x: x['date'], reverse=True)
            
            # Create table data
            table_data = [['Date', 'Category', 'Description', 'Amount']]
            
            for transaction in sorted_transactions:
                amount = transaction['amount']
                amount_str = f"${abs(amount):.2f}"
                if amount < 0:
                    amount_str = f"-{amount_str}"
                else:
                    amount_str = f"+{amount_str}"
                
                table_data.append([
                    datetime.fromisoformat(transaction['date']).strftime('%Y-%m-%d'),
                    transaction.get('category', 'N/A'),
                    transaction.get('note', 'No description'),
                    amount_str
                ])
            
            # Create table
            transaction_table = Table(table_data, colWidths=[1.2*inch, 1.3*inch, 2.5*inch, 1*inch])
            transaction_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2E86AB')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (3, 0), (3, -1), 'RIGHT'),  # Align amounts to right
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
            ]))
            
            # Color code amounts
            for i, transaction in enumerate(sorted_transactions, 1):
                if transaction['amount'] < 0:
                    transaction_table.setStyle(TableStyle([
                        ('TEXTCOLOR', (3, i), (3, i), colors.red)
                    ]))
                else:
                    transaction_table.setStyle(TableStyle([
                        ('TEXTCOLOR', (3, i), (3, i), colors.green)
                    ]))
            
            story.append(transaction_table)
        
        # Build PDF
        doc.build(story)
        return temp_file.name

    def send_weekly_report(self, user_email, user_name, transactions):
        """Send weekly financial report"""
        try:
            # Create PDF
            pdf_path = self.create_transaction_pdf(transactions, "Weekly", user_name)
            
            # Email content
            subject = f"CaptainLedger - Weekly Report ({datetime.now().strftime('%Y-%m-%d')})"
            
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2E86AB; margin: 0;">CaptainLedger</h1>
                        <h2 style="color: #666; margin: 10px 0;">Weekly Financial Report</h2>
                    </div>
                    
                    <p>Hello {user_name},</p>
                    
                    <p>Here's your weekly financial summary for the period ending {datetime.now().strftime('%B %d, %Y')}.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #2E86AB; margin-top: 0;">Summary</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li style="margin: 10px 0;"><strong>Transactions:</strong> {len(transactions)}</li>
                            <li style="margin: 10px 0; color: #28a745;"><strong>Income:</strong> ${sum(t['amount'] for t in transactions if t['amount'] > 0):.2f}</li>
                            <li style="margin: 10px 0; color: #dc3545;"><strong>Expenses:</strong> ${sum(abs(t['amount']) for t in transactions if t['amount'] < 0):.2f}</li>
                            <li style="margin: 10px 0;"><strong>Net:</strong> ${sum(t['amount'] for t in transactions):.2f}</li>
                        </ul>
                    </div>
                    
                    <p>Please find the detailed report attached as a PDF.</p>
                    
                    <div style="margin: 30px 0; padding: 20px; background-color: #e3f2fd; border-radius: 8px; border-left: 4px solid #2E86AB;">
                        <p style="margin: 0; color: #1565c0;"><strong>💡 Tip:</strong> Keep tracking your expenses regularly to maintain good financial habits!</p>
                    </div>
                    
                    <p>Best regards,<br>The CaptainLedger Team</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
                        <p>This is an automated email from CaptainLedger. Your privacy is important to us.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            self.send_email_with_attachment(user_email, subject, html_body, pdf_path, "weekly_report.pdf")
            
            # Clean up temporary file
            os.unlink(pdf_path)
            
        except Exception as e:
            current_app.logger.error(f"Error sending weekly report: {e}")
            raise

    def send_monthly_report(self, user_email, user_name, transactions, month_name):
        """Send monthly financial report"""
        try:
            # Create PDF
            pdf_path = self.create_transaction_pdf(transactions, f"Monthly - {month_name}", user_name)
            
            # Calculate additional monthly stats
            total_income = sum(t['amount'] for t in transactions if t['amount'] > 0)
            total_expenses = sum(abs(t['amount']) for t in transactions if t['amount'] < 0)
            net_savings = total_income - total_expenses
            avg_daily_expense = total_expenses / 30 if total_expenses > 0 else 0
            
            # Email content
            subject = f"CaptainLedger - Monthly Report for {month_name}"
            
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2E86AB; margin: 0;">CaptainLedger</h1>
                        <h2 style="color: #666; margin: 10px 0;">Monthly Financial Report</h2>
                        <h3 style="color: #2E86AB; margin: 10px 0;">{month_name}</h3>
                    </div>
                    
                    <p>Hello {user_name},</p>
                    
                    <p>Here's your comprehensive financial summary for {month_name}.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #2E86AB; margin-top: 0;">Monthly Overview</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <p style="margin: 5px 0;"><strong>Total Transactions:</strong> {len(transactions)}</p>
                                <p style="margin: 5px 0; color: #28a745;"><strong>Total Income:</strong> ${total_income:.2f}</p>
                                <p style="margin: 5px 0; color: #dc3545;"><strong>Total Expenses:</strong> ${total_expenses:.2f}</p>
                            </div>
                            <div>
                                <p style="margin: 5px 0;"><strong>Net Savings:</strong> ${net_savings:.2f}</p>
                                <p style="margin: 5px 0;"><strong>Avg. Daily Expense:</strong> ${avg_daily_expense:.2f}</p>
                                <p style="margin: 5px 0;"><strong>Savings Rate:</strong> {(net_savings/total_income*100 if total_income > 0 else 0):.1f}%</p>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background-color: {'#d4edda' if net_savings >= 0 else '#f8d7da'}; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: {'#155724' if net_savings >= 0 else '#721c24'};"><strong>
                            {'🎉 Great job! You saved money this month.' if net_savings >= 0 else '⚠️ You spent more than you earned this month.'}
                        </strong></p>
                    </div>
                    
                    <p>Please find the detailed report attached as a PDF.</p>
                    
                    <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                        <p style="margin: 0; color: #856404;"><strong>💰 Monthly Tip:</strong> 
                        {"Consider setting up an emergency fund if you haven't already!" if net_savings >= 0 else "Try to identify your biggest expense categories and see where you can cut back."}
                        </p>
                    </div>
                    
                    <p>Best regards,<br>The CaptainLedger Team</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
                        <p>This is an automated email from CaptainLedger. Your privacy is important to us.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            self.send_email_with_attachment(user_email, subject, html_body, pdf_path, f"monthly_report_{month_name.replace(' ', '_').lower()}.pdf")
            
            # Clean up temporary file
            os.unlink(pdf_path)
            
        except Exception as e:
            current_app.logger.error(f"Error sending monthly report: {e}")
            raise

    def send_email_with_attachment(self, to_email, subject, html_body, attachment_path, attachment_name):
        """Send email with PDF attachment"""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.email
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add HTML body
            msg.attach(MIMEText(html_body, 'html'))
            
            # Add attachment
            with open(attachment_path, "rb") as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
                
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {attachment_name}',
            )
            msg.attach(part)
            
            # Send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.email, self.password)
            server.send_message(msg)
            server.quit()
            
            current_app.logger.info(f"Email sent successfully to {to_email}")
            
        except Exception as e:
            current_app.logger.error(f"Error sending email: {e}")
            raise

email_service = EmailService()