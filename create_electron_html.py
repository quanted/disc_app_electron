"""
create_electron_html.py
python manage.py shell
exec(open('disc_app_electron/create_electron_html.py').read())
"""

from django.template.loader import render_to_string
import os, errno
from shutil import copyfile
from shutil import copy

try:
    os.makedirs('disc_app_electron/hwbi_app')
    os.makedirs('disc_app_electron/static_qed/hwbi/disc/css')
    os.makedirs('disc_app_electron/static_qed/hwbi/disc/img')
    os.makedirs('disc_app_electron/static_qed/hwbi/disc/js')
    os.makedirs('disc_app_electron/templates_qed/hwbi/disc')
    os.makedirs('disc_app_electron/hwbi_app')
except OSError as e:
    if e.errno != errno.EEXIST:
        raise

copyfile('static_qed/hwbi/disc/css/hwbi-disc-app.css', 'disc_app_electron/static_qed/hwbi/disc/css/hwbi-disc-app.css')
copyfile('static_qed/hwbi/disc/css/jquery-ui.min.css', 'disc_app_electron/static_qed/hwbi/disc/css/jquery-ui.min.css')

copyfile('static_qed/hwbi/disc/js/jquery-ui.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/jquery-ui.min.js')
copyfile('static_qed/hwbi/disc/js/hwbi-disc-app.js', 'disc_app_electron/static_qed/hwbi/disc/js/hwbi-disc-app.js')
copyfile('static_qed/hwbi/disc/js/hwbi-disc-report-v2.js', 'disc_app_electron/static_qed/hwbi/disc/js/hwbi-disc-report-v2.js')
copyfile('static_qed/hwbi/disc/js/jquery-3.3.1.min.js', 'disc_app_electron/static_qed/hwbi/disc/js/jquery-3.3.1.min.js')
copyfile('static_qed/hwbi/disc/js/statecounty.json', 'disc_app_electron/static_qed/hwbi/disc/js/statecounty.json')
copyfile('static_qed/hwbi/disc/js/statestateabbr.json', 'disc_app_electron/static_qed/hwbi/disc/js/statestateabbr.json')

copyfile('static_qed/hwbi/disc/img/connection_to_nature.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/connection_to_nature.jpg')
copyfile('static_qed/hwbi/disc/img/cultural_fulfillment.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/cultural_fulfillment.jpg')
copyfile('static_qed/hwbi/disc/img/domain_arrow.png', 'disc_app_electron/static_qed/hwbi/disc/img/domain_arrow.png')
copyfile('static_qed/hwbi/disc/img/domain_bar.png', 'disc_app_electron/static_qed/hwbi/disc/img/domain_bar.png')
copyfile('static_qed/hwbi/disc/img/education.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/education.jpg')
copyfile('static_qed/hwbi/disc/img/health.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/health.jpg')
copyfile('static_qed/hwbi/disc/img/leisure_time.png', 'disc_app_electron/static_qed/hwbi/disc/img/leisure_time.png')
copyfile('static_qed/hwbi/disc/img/living_standards.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/living_standards.jpg')
copyfile('static_qed/hwbi/disc/img/safety.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/safety.jpg')
copyfile('static_qed/hwbi/disc/img/social_cohesion.jpg', 'disc_app_electron/static_qed/hwbi/disc/img/social_cohesion.jpg')
copyfile('static_qed/hwbi/disc/img/loader.gif', 'disc_app_electron/static_qed/hwbi/disc/img/loader.gif')
copyfile('static_qed/hwbi/disc/img/rainbow_need_to_replace.png', 'disc_app_electron/static_qed/hwbi/disc/img/rainbow_need_to_replace.png')

copyfile('hwbi_app/hwbi_db.sqlite3', 'disc_app_electron/hwbi_app/hwbi_db.sqlite3')


temp_google_key = 'AIzaSyDEC5r_Tq31qfF8BKIdhUAH1KorOfjLV4g'
electron = True
# EPA drupal page template
html = render_to_string('disc/drupal_2017/01epa_drupal_header.html', {
    'title': 'Decision Integration for Strong Communities',
    'electron': electron
})
html += render_to_string('disc/drupal_2017/02epa_drupal_header_bluestripe.html', {
    'electron': electron
})
imports = render_to_string('disc/hwbi-disc-app-imports.html', {'API_KEY': temp_google_key}) # Modify?
html += imports
html += render_to_string('disc/drupal_2017/03epa_drupal_section_title_generic.html', {
    'HEADER': 'Decision Integration for Strong Communities',
    "electron": electron
})
body = render_to_string('disc/hwbi-disc-app-body.html') # Modify
html += body
html += render_to_string('disc/drupal_2017/10epa_drupal_footer.html', {
    'electron': electron
})
#print(html)
#f = open('disc_app_electron/templates_qed/hwbi/disc/index.html', 'w')
f = open('disc_app_electron/index.html', 'w')
f.write(html)
f.closed
