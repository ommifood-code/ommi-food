/* Optional dish images for Ommi Food kitchen builder. Images are never required. */
const _ommiBaseAddDish = addDish;

function ommiAttachImageField(row) {
  if (!row || row.querySelector('.dish-image-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'dish-image-wrap';
  wrap.innerHTML = `<label class="dish-image-label"><span>عندك صورة للطبق؟ أضيفيها الآن</span><small>الصورة تساعد الزبائن على معرفة طبقك واختياره. لا توجد صورة؟ لا بأس، يمكنك إضافتها لاحقًا.</small><input class="dish-image" type="file" accept="image/jpeg,image/png,image/webp" hidden><button type="button" class="dish-image-btn">اختيار صورة</button></label><div class="dish-image-preview" hidden><img alt="معاينة صورة الطبق"><button type="button" class="dish-image-remove">حذف الصورة</button></div>`;
  row.appendChild(wrap);

  const input = wrap.querySelector('.dish-image');
  const button = wrap.querySelector('.dish-image-btn');
  const preview = wrap.querySelector('.dish-image-preview');
  const img = preview.querySelector('img');
  const remove = wrap.querySelector('.dish-image-remove');

  button.onclick = () => input.click();
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      input.value = '';
      showToast('اختاري صورة JPG أو PNG أو WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      input.value = '';
      showToast('حجم الصورة يجب ألا يتجاوز 5 MB.');
      return;
    }
    if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.dataset.objectUrl = objectUrl;
    preview.hidden = false;
    button.textContent = 'تغيير الصورة';
  };
  remove.onclick = () => {
    if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
    input.value = '';
    img.removeAttribute('src');
    delete img.dataset.objectUrl;
    preview.hidden = true;
    button.textContent = 'اختيار صورة';
  };
}

addDish = function(name = '', price = '') {
  _ommiBaseAddDish(name, price);
  const rows = document.querySelectorAll('.builder-dish-row');
  ommiAttachImageField(rows[rows.length - 1]);
};

async function ommiUploadDishImages(dishes) {
  const rows = [...document.querySelectorAll('.builder-dish-row')];
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const name = rows[i].querySelector('.dish-name')?.value.trim();
    const price = rows[i].querySelector('.dish-price')?.value.trim();
    if (!name) continue;
    const file = rows[i].querySelector('.dish-image')?.files?.[0];
    let image_url = null;
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${currentChefId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await db.storage.from('dish-images').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = db.storage.from('dish-images').getPublicUrl(path);
      image_url = data.publicUrl;
    }
    result.push({ name, price, image_url });
  }
  return result;
}

const _ommiSubmitKitchen = document.getElementById('submitKitchenBtn').onclick;
document.getElementById('submitKitchenBtn').onclick = async function() {
  const rows = [...document.querySelectorAll('.builder-dish-row')];
  const hasImages = rows.some(r => r.querySelector('.dish-image')?.files?.length);
  if (!hasImages) return _ommiSubmitKitchen.call(this);

  const bio = document.getElementById('builderBio').value.trim();
  const specialty = document.getElementById('builderSpecialty').value.trim();
  const basicDishes = collectDishes();
  const days = [...document.querySelectorAll('#builderDays button.selected')].map(b => b.dataset.day);
  const from = document.getElementById('builderFrom').value;
  const to = document.getElementById('builderTo').value;
  const fulfilment = document.getElementById('builderFulfilment').value;
  const deliveryBy = document.getElementById('builderDeliveryBy').value;
  if (!bio || !specialty || !basicDishes.length || !days.length || !from || !to) { showToast('أكملي الخطوات الأساسية قبل الحفظ.'); return; }
  if (basicDishes.some(d => !d.price)) { showToast('أضيفي ثمنًا لكل طبق.'); return; }

  const btn = this;
  btn.disabled = true;
  btn.textContent = 'جاري حفظ مطبخك...';
  try {
    const dishes = await ommiUploadDishImages(basicDishes);
    const { error } = await db.rpc('chef_portal_save', { p_chef_id: currentChefId, p_bio: bio, p_specialty: specialty, p_dishes: dishes, p_work_days: days.join('، '), p_work_hours: `${from} - ${to}`, p_fulfilment_type: fulfilment, p_delivery_by: deliveryBy });
    if (error) throw error;
    showToast('تم حفظ مطبخك. أصبح جاهزًا لمراجعة Ommi Food.');
    btn.textContent = 'تم حفظ مطبخك';
  } catch (error) {
    console.error(error);
    showToast('تعذر حفظ الصورة أو المطبخ. حاولي مرة أخرى.');
    btn.disabled = false;
    btn.textContent = 'حفظ مطبخي وإرساله للمراجعة';
  }
};