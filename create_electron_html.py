"""
create_electron_html.py
python manage.py shell
exec(open('disc_app_electron/create_electron_html.py').read())
"""

from django.template.loader import render_to_string
import os, errno
from shutil import copyfile
from shutil import copy
import sqlite3

db = sqlite3.connect("hwbi_app/DISC.db")
cur = db.cursor()

cur.execute('select * from Domains')
domains = cur.fetchall()

cur.execute('select * from Indicators')
indicators = cur.fetchall()

cur.execute("select * from MetricGroups WHERE METRIC_GRP != 'HWBI' AND METRIC_GRP != 'CRSI'")
metricGroups = cur.fetchall()
#print(metricGroups)

cur.execute("SELECT MetricVars.METRIC_VAR, MetricVars.METRIC_VAR_DESC, Domains.DOMAIN, Indicators.INDICATOR, MetricGroups_Domains.METRIC_GRP, MetricVars.MINVAL, " +
        "MetricVars.MAXVAL, MetricVars.POS_NEG_METRIC, MetricVars.METRIC_VAR_DESC, MetricVars.UNITS, Indicators.INDICATOR_DESC, Domains.DOMAIN_DESC, MetricVars.METRIC, MetricVars.SOURCE " +
    "FROM MetricVars " +
    "INNER JOIN Indicators_MetricVars ON MetricVars.METRIC_VAR == Indicators_MetricVars.METRIC_VAR " +
    "INNER JOIN Domains_Indicators ON Domains_Indicators.INDICATOR == Indicators_MetricVars.INDICATOR " +
    "INNER JOIN MetricGroups_Domains ON Domains_Indicators.DOMAIN == MetricGroups_Domains.DOMAIN " +
    "INNER JOIN Indicators ON Indicators.INDICATOR == Indicators_MetricVars.INDICATOR " +
    "INNER JOIN Domains ON Domains_Indicators.DOMAIN == Domains.DOMAIN " +
    "INNER JOIN MetricGroups ON MetricGroups_Domains.METRIC_GRP == MetricGroups.METRIC_GRP  " +
    "WHERE MetricGroups.METRIC_GRP != 'HWBI' AND MetricGroups.METRIC_GRP != 'CRSI';")
service_metrics = cur.fetchall()
#print(service_metrics)

cur.execute("SELECT MetricVars.METRIC_VAR, MetricVars.METRIC_VAR_DESC, Domains.DOMAIN, Indicators.INDICATOR, MetricGroups_Domains.METRIC_GRP, MetricVars.MINVAL, " +
        "MetricVars.MAXVAL, MetricVars.POS_NEG_METRIC, MetricVars.METRIC_VAR_DESC, MetricVars.UNITS, Indicators.INDICATOR_DESC, Domains.DOMAIN_DESC, MetricVars.METRIC, MetricVars.SOURCE, DomainOrder.LIST_ORDER " +
    "FROM MetricVars " +
    "INNER JOIN Indicators_MetricVars ON MetricVars.METRIC_VAR == Indicators_MetricVars.METRIC_VAR " +
    "INNER JOIN Domains_Indicators ON Domains_Indicators.INDICATOR == Indicators_MetricVars.INDICATOR " +
    "INNER JOIN MetricGroups_Domains ON Domains_Indicators.DOMAIN == MetricGroups_Domains.DOMAIN " +
    "INNER JOIN Indicators ON Indicators.INDICATOR == Indicators_MetricVars.INDICATOR " +
    "INNER JOIN Domains ON Domains_Indicators.DOMAIN == Domains.DOMAIN " +
    "INNER JOIN DomainOrder ON Domains_Indicators.DOMAIN == DomainOrder.DOMAIN " +
    "INNER JOIN MetricGroups ON MetricGroups_Domains.METRIC_GRP == MetricGroups.METRIC_GRP " +
    "WHERE MetricGroups.METRIC_GRP == 'HWBI' OR MetricGroups.METRIC_GRP == 'CRSI' " +
    "ORDER BY DomainOrder.LIST_ORDER ASC;")
hwbi_metrics = cur.fetchall()

try:
    os.makedirs('disc_app_electron/hwbi_app')
except OSError as e:
    if e.errno != errno.EEXIST:
        raise
try:
    os.makedirs('disc_app_electron/static_qed/hwbi/disc/css')
except OSError as e:
    if e.errno != errno.EEXIST:
        raise
try:
    os.makedirs('disc_app_electron/static_qed/hwbi/disc/fonts')
except OSError as e:
    if e.errno != errno.EEXIST:
        raise
try:
    os.makedirs('disc_app_electron/static_qed/hwbi/disc/img')
except OSError as e:
    if e.errno != errno.EEXIST:
        raise
try:
    os.makedirs('disc_app_electron/static_qed/hwbi/disc/js')
except OSError as e:
    if e.errno != errno.EEXIST:
        raise
try:
    os.makedirs('disc_app_electron/templates_qed/hwbi/disc')
except OSError as e:
    if e.errno != errno.EEXIST:
        raise

copyfile('static_qed/hwbi/disc/css/hwbi-disc-app.css', 'disc_app_electron/static_qed/hwbi/disc/css/hwbi-disc-app.css')
copyfile('static_qed/hwbi/disc/css/jquery-ui.min.css', 'disc_app_electron/static_qed/hwbi/disc/css/jquery-ui.min.css')
copyfile('static_qed/hwbi/disc/css/donut.css', 'disc_app_electron/static_qed/hwbi/disc/css/donut.css')
copyfile('static_qed/hwbi/disc/css/hwbi-disc-compare-map.css', 'disc_app_electron/static_qed/hwbi/disc/css/hwbi-disc-compare-map.css')
copyfile('static_qed/hwbi/disc/css/material-icons.css', 'disc_app_electron/static_qed/hwbi/disc/css/material-icons.css')

copyfile('static_qed/hwbi/disc/fonts/material-icons.woff2', 'disc_app_electron/static_qed/hwbi/disc/fonts/material-icons.woff2')

copyfile('static_qed/hwbi/disc/js/jquery-ui.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/jquery-ui.min.js')
copyfile('static_qed/hwbi/disc/js/hwbi-disc-app.js', 'disc_app_electron/static_qed/hwbi/disc/js/hwbi-disc-app.js')
copyfile('static_qed/hwbi/disc/js/hwbi-disc-report-v2.js', 'disc_app_electron/static_qed/hwbi/disc/js/hwbi-disc-report-v2.js')
copyfile('static_qed/hwbi/disc/js/jquery-3.3.1.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/jquery-3.3.1.min.js')
copyfile('static_qed/hwbi/disc/js/main.js', 'disc_app_electron/static_qed/hwbi/disc/js/main.js')
copyfile('static_qed/hwbi/disc/js/apexcharts.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/apexcharts.min.js')
#copyfile('static_qed/hwbi/disc/js/d3.v3.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/d3.v3.min.js')
copyfile('static_qed/hwbi/disc/js/d3.v5.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/d3.v5.min.js')
#copyfile('static_qed/hwbi/disc/js/d3-tip.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/d3-tip.min.js')
copyfile('static_qed/hwbi/disc/js/draw.js', 'disc_app_electron/static_qed/hwbi/disc/js/draw.js')
copyfile('static_qed/hwbi/disc/js/donut.js', 'disc_app_electron/static_qed/hwbi/disc/js/donut.js')
copyfile('static_qed/hwbi/disc/js/topojson.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/topojson.min.js')
copyfile('static_qed/hwbi/disc/js/hwbi-disc-compare.js', 'disc_app_electron/static_qed/hwbi/disc/js/hwbi-disc-compare.js')
copyfile('static_qed/hwbi/disc/js/intro.js', 'disc_app_electron/static_qed/hwbi/disc/js/intro.js')
copyfile('static_qed/hwbi/disc/css/introjs.css', 'disc_app_electron/static_qed/hwbi/disc/css/introjs.css')
copyfile('static_qed/hwbi/disc/css/introjs-nassim.css', 'disc_app_electron/static_qed/hwbi/disc/css/introjs-nassim.css')

copyfile('static_qed/hwbi/disc/js/statecounty.json', 'disc_app_electron/static_qed/hwbi/disc/js/statecounty.json')
copyfile('static_qed/hwbi/disc/js/statestateabbr.json', 'disc_app_electron/static_qed/hwbi/disc/js/statestateabbr.json')

copyfile('static_qed/hwbi/disc/img/connection-to-nature.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/connection-to-nature.jpg')
copyfile('static_qed/hwbi/disc/img/cultural-fulfillment.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/cultural-fulfillment.jpg')
copyfile('static_qed/hwbi/disc/img/domain_arrow.png', 'disc_app_electron/static_qed/hwbi/disc/img/domain_arrow.png')
copyfile('static_qed/hwbi/disc/img/domain_bar.png', 'disc_app_electron/static_qed/hwbi/disc/img/domain_bar.png')
copyfile('static_qed/hwbi/disc/img/education.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/education.jpg')
copyfile('static_qed/hwbi/disc/img/health.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/health.jpg')
copyfile('static_qed/hwbi/disc/img/leisure-time.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/leisure-time.jpg')
copyfile('static_qed/hwbi/disc/img/living-standards.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/living-standards.jpg')
copyfile('static_qed/hwbi/disc/img/safety-and-security.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/safety-and-security.jpg')
copyfile('static_qed/hwbi/disc/img/social-cohesion.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/social-cohesion.jpg')
copyfile('static_qed/hwbi/disc/img/resilience.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/resilience.jpg')
copyfile('static_qed/hwbi/disc/img/economic.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/economic.jpg')
copyfile('static_qed/hwbi/disc/img/ecosystem.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/ecosystem.jpg')
copyfile('static_qed/hwbi/disc/img/social.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/social.jpg')
copyfile('static_qed/hwbi/disc/img/loader.gif', 'disc_app_electron/static_qed/hwbi/disc/img/loader.gif')
copyfile('static_qed/hwbi/disc/img/rainbow_need_to_replace.png', 'disc_app_electron/static_qed/hwbi/disc/img/rainbow_need_to_replace.png')
copyfile('static_qed/hwbi/disc/img/searchdark.png', 'disc_app_electron/static_qed/hwbi/disc/img/searchdark.png')
copyfile('static_qed/hwbi/disc/img/no-internet.png', 'disc_app_electron/static_qed/hwbi/disc/img/no-internet.png')
copyfile('static_qed/hwbi/disc/img/connected.png', 'disc_app_electron/static_qed/hwbi/disc/img/connected.png')
copyfile('static_qed/hwbi/disc/img/question-circle-regular.svg', 'disc_app_electron/static_qed/hwbi/disc/img/question-circle-regular.svg')

copyfile('hwbi_app/DISC.db', 'disc_app_electron/hwbi_app/DISC.db')
copyfile('hwbi_app/cities.db', 'disc_app_electron/hwbi_app/cities.db')

copyfile('static_qed/hwbi/disc/css/mainstyle.css', 'disc_app_electron/static_qed/hwbi/disc/css/mainstyle.css')
copyfile('static_qed/hwbi/disc/img/epa2.gif', 'disc_app_electron/static_qed/hwbi/disc/img/epa2.gif')
copyfile('static_qed/hwbi/disc/img/epawhite.png', 'disc_app_electron/static_qed/hwbi/disc/img/epawhite.png')
copyfile('static_qed/hwbi/disc/img/searchblack.png', 'disc_app_electron/static_qed/hwbi/disc/img/searchblack.png')
copyfile('static_qed/hwbi/disc/img/searchwhite.png', 'disc_app_electron/static_qed/hwbi/disc/img/searchwhite.png')
copyfile('static_qed/hwbi/disc/img/bg1.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/bg1.jpg')


temp_google_key = 'AIzaSyDEC5r_Tq31qfF8BKIdhUAH1KorOfjLV4g'
electron = True
# EPA drupal page template
html = render_to_string('disc/drupal_2017/01epa_drupal_header.html', {
    'title': 'Conceptual Decision Integration for Strong Communities | BETA',
    'electron': electron
})
""" html += render_to_string('disc/drupal_2017/02epa_drupal_header_bluestripe.html', {
    'electron': electron
})  """
imports = render_to_string('disc/hwbi-disc-app-imports.html', {'API_KEY': temp_google_key}) # Modify?
html += imports
""" html += render_to_string('disc/drupal_2017/03epa_drupal_section_title_generic.html', {
    'HEADER': 'Conceptual Decision Integration for Strong Communities | BETA',
    "electron": electron
}) """
# body = render_to_string('disc/hwbi-disc-app-body1.html') # Modify (tabs)
body = render_to_string('disc/mainpage.html')
body += render_to_string('disc/hwbi-disc-app-body2.html', {
    'service_metrics': service_metrics,
    'hwbi_metrics': hwbi_metrics,
}) # Modify (tab content)
body += render_to_string('disc/content-wrapper.html', {
    'electron': electron
})
# body += render_to_string('disc/hwbi-disc-app-body3.html') # Modify 
html += body
""" html += render_to_string('disc/drupal_2017/10epa_drupal_footer.html', {
    'electron': electron
}) """
#print(html)
#f = open('disc_app_electron/templates_qed/hwbi/disc/index.html', 'w')
f = open('disc_app_electron/index.html', 'w', encoding="utf-8")
f.write(html)
f.closed
