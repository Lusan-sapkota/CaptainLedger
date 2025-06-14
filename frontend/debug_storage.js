// Add this to browser console to check current storage
console.log('Checking storage...');
Object.keys(localStorage).forEach(key => {
  console.log(key + ':', localStorage.getItem(key));
});
